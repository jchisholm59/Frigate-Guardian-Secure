import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import mqtt, { type MqttClient } from 'mqtt';
import { Readable, Transform } from 'stream';
import nodemailer from 'nodemailer';

// In-Memory HEVC (H.265) binary patcher to convert 'hev1' containers to Apple-compatible 'hvc1' containers
class HevcPatchStream extends Transform {
  private tail: Buffer = Buffer.alloc(0);
  private search: Buffer = Buffer.from('hev1');
  private replace: Buffer = Buffer.from('hvc1');

  _transform(chunk: any, encoding: string, callback: Function) {
    // Prepend the tail from the last chunk to catch split tags
    let data = Buffer.concat([this.tail, chunk]);
    let pos = 0;

    // Find and replace all occurrences
    while ((pos = data.indexOf(this.search, pos)) !== -1) {
      this.replace.copy(data, pos);
      pos += 4;
    }

    // Keep the last 3 bytes as tail (in case 'hev' is at the end of the chunk)
    const tailSize = this.search.length - 1;
    if (data.length > tailSize) {
      this.push(data.slice(0, data.length - tailSize));
      this.tail = data.slice(data.length - tailSize);
    } else {
      this.tail = data;
    }
    callback();
  }

  _flush(callback: Function) {
    this.push(this.tail);
    callback();
  }
}

// Environment compatibility for ESM/CJS
const __filename = typeof import.meta.url !== 'undefined'
  ? fileURLToPath(import.meta.url)
  : (typeof __filename !== 'undefined' ? __filename : '');
const __dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : (__filename ? path.dirname(__filename) : process.cwd());

// Load environment variables
dotenv.config(); // Loads .env
if (fs.existsSync(path.join(__dirname, 'guardian.env'))) {
  dotenv.config({ path: path.join(__dirname, 'guardian.env'), override: true });
}

// Fix for 'require' in ESM
const require = createRequire(import.meta.url || `file://${__filename}`);
const archiver = require('archiver');

let aiClient: GoogleGenAI | null = null;

// Server-side persistent settings for background notifications
const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.frigate-guardian');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, 'notification_settings.json');
const MQTT_CONFIG_FILE = path.join(DATA_DIR, 'mqtt_config.json');
const BIRD_SIGHTINGS_FILE = path.join(DATA_DIR, 'bird_sightings.json');
const SERVERS_FILE = path.join(DATA_DIR, 'frigate_servers.json');

// Migration: Move files from project .data directory to home directory if they exist
try {
  const legacyDir = path.join(__dirname, '.data');
  if (fs.existsSync(legacyDir)) {
    const files = ['notification_settings.json', 'mqtt_config.json', 'bird_sightings.json', 'frigate_servers.json'];
    for (const file of files) {
      const oldPath = path.join(legacyDir, file);
      const newPath = path.join(DATA_DIR, file);
      if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        fs.copyFileSync(oldPath, newPath);
        console.log(`[Migration] Moved ${file} to permanent storage in ${DATA_DIR}`);
      }
    }
  }
} catch (err) {
  console.error('[Migration] Failed to migrate settings:', err);
}

let persistentSettings: any = {
  gmail: { enabled: false },
  slack: { enabled: false },
  discord: { enabled: false },
  filters: {
    minImportance: 'all',
    minThreatLevel: 'all',
    targetLabels: [],
    selectedCameras: []
  },
  birdnet: {
    enabled: false,
    brokerHost: '',
    port: 1883,
    topic: 'birdnet-sightings',
    serverUrl: '',
    liveAudioUrl: '',
    username: '',
    password: '',
    sendDailyAlerts: false
  },
  tides: {
    stations: [],
    refreshIntervalMinutes: 60
  }
};

let birdSightings: any[] = [];
let persistentServers: any[] = [];
let speciesFactCache: Record<string, string> = {};
let dailyAlertedSpecies = new Set<string>();
let lastBirdAlertReset = new Date().getUTCDate();

// Track stationary vehicles to prevent "jitter" notifications
// Map: camera_label -> { x, y, timestamp }
const parkedVehicles = new Map<string, { x: number, y: number, timestamp: number }>();

// Load settings on startup
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    persistentSettings = JSON.parse(data);
    console.log('[Settings] Loaded persistent notification settings from disk');
  }
} catch (err) {
  console.error('[Settings] Failed to load persistent settings:', err);
}

// Load bird sightings on startup
try {
  if (fs.existsSync(BIRD_SIGHTINGS_FILE)) {
    const data = fs.readFileSync(BIRD_SIGHTINGS_FILE, 'utf-8');
    birdSightings = JSON.parse(data);
    console.log(`[Birds] Loaded ${birdSightings.length} sightings from disk`);
  }
} catch (err) {
  console.error('[Birds] Failed to load sightings:', err);
}

// Load frigate servers on startup
try {
  if (fs.existsSync(SERVERS_FILE)) {
    const data = fs.readFileSync(SERVERS_FILE, 'utf-8');
    persistentServers = JSON.parse(data);
    console.log(`[Servers] Loaded ${persistentServers.length} servers from disk`);
  }
} catch (err) {
  console.error('[Servers] Failed to load servers:', err);
}

function saveBirdSightings() {
  try {
    const newData = JSON.stringify(birdSightings.slice(0, 1000), null, 2); // Keep last 1000
    fs.writeFileSync(BIRD_SIGHTINGS_FILE, newData);
  } catch (err) {
    console.error('[Birds] Failed to save sightings:', err);
  }
}

function savePersistentSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(persistentSettings, null, 2));
  } catch (err) {
    console.error('[Settings] Failed to save settings:', err);
  }
}

function getAiClient() {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI] GEMINI_API_KEY not found in environment.');
    return null;
  }
  aiClient = new GoogleGenAI(apiKey);
  return aiClient;
}

// AI Service Helper
async function generateAiContent(prompt: string, isJson: boolean = false) {
  const ollamaUrl = process.env.OLLAMA_URL;
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';

  if (ollamaUrl) {
    try {
      console.log(`[AI] Using local Ollama (${ollamaModel}) at ${ollamaUrl}...`);
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        body: JSON.stringify({
          model: ollamaModel,
          prompt: prompt,
          stream: false,
          format: isJson ? 'json' : undefined
        })
      });
      const data = await response.json();
      return data.response;
    } catch (err: any) {
      console.warn(`[AI] Ollama failed: ${err.message}. Falling back...`);
    }
  }

  const ai = getAiClient();
  if (ai) {
    console.log(`[AI] Using Google Gemini 3.1 Flash-Lite...`);
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
    return response.text;
  }

  return null;
}

let birdMqttClient: MqttClient | null = null;
const birdMqttStatus = {
  connected: false,
  connecting: false,
  error: null as string | null
};

function connectToBirdMqtt() {
  const config = persistentSettings.birdnet;
  if (!config || !config.enabled || !config.brokerHost) return;

  if (birdMqttClient) {
    birdMqttClient.end();
  }

  birdMqttStatus.connecting = true;
  birdMqttStatus.error = null;

  try {
    const brokerUrl = `mqtt://${config.brokerHost}:${config.port || 1883}`;
    console.log(`[BirdNET] Connecting to ${brokerUrl}...`);

    birdMqttClient = mqtt.connect(brokerUrl, {
      username: config.username,
      password: config.password,
      reconnectPeriod: 5000,
    });

    birdMqttClient.on('connect', () => {
      console.log(`[BirdNET] Connected to MQTT broker at ${config.brokerHost}`);
      birdMqttStatus.connected = true;
      birdMqttStatus.connecting = false;
      birdMqttClient?.subscribe(config.topic || 'birdnet-sightings');
    });

    birdMqttClient.on('message', async (topic, messageBuffer) => {
      try {
        const strPayload = messageBuffer.toString('utf-8');
        const payload = JSON.parse(strPayload);

        if (payload.commonName || payload.CommonName) {
          const commonName = payload.commonName || payload.CommonName;
          const detectionId = payload.detectionId || payload.id;

          let imageUrl = payload.BirdImage?.URL || `https://en.wikipedia.org/wiki/${encodeURIComponent(commonName)}`;

          if (!payload.BirdImage?.URL) {
            try {
              const wikiApiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(commonName)}`;
              const wikiResp = await fetch(wikiApiUrl);
              if (wikiResp.ok) {
                const wikiData = await wikiResp.json();
                if (wikiData.thumbnail?.source) {
                  imageUrl = wikiData.thumbnail.source;
                }
              }
            } catch (e) {}
          }

          let funFact = speciesFactCache[commonName];
          if (!funFact && persistentSettings.birdnet?.enabled) {
            try {
              const ai = getAiClient();
              if (ai) {
                const prompt = `You are an expert ornithologist. Give me one single, very interesting, tactically relevant behavioral fact about the ${commonName}. Keep it under 20 words. No intro.`;
                const result = await ai.models.generateContent({
                  model: 'gemini-3.1-flash-lite-preview',
                  contents: prompt,
                });
                funFact = result.text.trim();
                speciesFactCache[commonName] = funFact;
                console.log(`[Bird AI] Auto-generated fact for ${commonName}`);
              }
            } catch (err) {
              console.warn(`[Bird AI] Auto-fact failed:`, err);
            }
          }

          const sighting = {
            id: detectionId || `bird-${Date.now()}`,
            commonName: commonName,
            scientificName: payload.scientificName || payload.ScientificName,
            confidence: payload.confidence || payload.Confidence || 0,
            timestamp: Date.now(),
            sourceNode: payload.sourceName || payload.SourceNode || 'BirdNET-Go',
            imageUrl: imageUrl,
            wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(commonName)}`,
            funFact: funFact,
            isAiAnalyzed: Boolean(funFact),
            audioUrl: config.serverUrl && detectionId
              ? `/api/birds/proxy/audio/${detectionId}?serverUrl=${encodeURIComponent(config.serverUrl)}`
              : undefined
          };

          birdSightings.unshift(sighting);
          if (birdSightings.length > 500) birdSightings.pop();
          saveBirdSightings();

          broadcastToSse({ type: 'bird_sighting', sighting });
          console.log(`[BirdNET] Heard: ${sighting.commonName} (${Math.round(sighting.confidence * 100)}%)`);

          const today = new Date().getUTCDate();
          if (lastBirdAlertReset !== today) {
            dailyAlertedSpecies.clear();
            lastBirdAlertReset = today;
          }

          if (!dailyAlertedSpecies.has(commonName) && sighting.confidence > 0.6 && persistentSettings.birdnet?.sendDailyAlerts) {
            dailyAlertedSpecies.add(commonName);
            const isGmail = persistentSettings.gmail?.enabled;
            const isSlack = persistentSettings.slack?.enabled;
            const isDiscord = persistentSettings.discord?.enabled;

            if (isGmail || isSlack || isDiscord) {
              const birdEvent = {
                id: sighting.id,
                camera: sighting.sourceNode,
                label: commonName,
                score: sighting.confidence,
                startTime: sighting.timestamp,
                duration: 3,
                zones: ['Aerial / Yard'],
                importance: 'detection' as const,
                threatLevel: 'low' as const,
                summary: `New Species Sighted: ${commonName}. ${funFact || ''}`,
                recommendedAction: 'View bird in Yard Intelligence tab.',
                box: { x: 0, y: 0, width: 1, height: 1 },
                snapshotUrl: sighting.imageUrl,
                clipUrl: sighting.audioUrl,
              };
              dispatchNotification(birdEvent, persistentSettings).catch(err => {
                console.error(`[Bird Alert] Failed to dispatch: ${err.message}`);
              });
            }
          }
        }
      } catch (err) {
        console.error('[BirdNET] Failed to parse message:', err);
      }
    });

    birdMqttClient.on('error', (err) => {
      birdMqttStatus.error = err.message;
      birdMqttStatus.connecting = false;
      birdMqttStatus.connected = false;
    });

    birdMqttClient.on('close', () => {
      birdMqttStatus.connected = false;
      birdMqttStatus.connecting = false;
    });
  } catch (e: any) {
    birdMqttStatus.error = e.message;
    birdMqttStatus.connecting = false;
  }
}

// Search for stations by name or code (Smarter filtering)
app.get('/api/tides/stations/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).send('Query parameter q is required');

  try {
    const searchTerm = String(q).toLowerCase();
    console.log(`[Tides] Searching for: "${searchTerm}"`);

    const url = `https://api-iwls.dfo-mpo.gc.ca/api/v1/stations`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`DFO API returned ${resp.status}`);

    const allStations = await resp.json();
    if (!Array.isArray(allStations)) throw new Error('DFO API returned non-array data');

    const filtered = allStations.filter(s => {
      if (!s) return false;
      const name = String(s.officialName || s.name || '').toLowerCase();
      const code = String(s.code || '').toLowerCase();
      const province = String(s.provinceCode || s.province || '').toLowerCase();
      return name.includes(searchTerm) || code.includes(searchTerm) || province.includes(searchTerm);
    }).slice(0, 15);

    res.json({ success: true, stations: filtered });
  } catch (err: any) {
    console.error('[Tides] Search error:', err.message);
    res.status(500).json({ error: 'Failed to search tidal stations' });
  }
});

// Get current and predicted data for a station
app.get('/api/tides/data/:stationId', async (req, res) => {
  const { stationId } = req.params;
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const seriesUrl = `https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/${stationId}/data?timeSeriesCode=wlp&from=${from}&to=${to}`;
    const hiloUrl = `https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/${stationId}/data?timeSeriesCode=wlp-hilo&from=${from}&to=${to}`;

    const [seriesResp, hiloResp] = await Promise.all([fetch(seriesUrl), fetch(hiloUrl)]);
    const [series, hilo] = await Promise.all([
      seriesResp.ok ? seriesResp.json() : Promise.resolve([]),
      hiloResp.ok ? hiloResp.json() : Promise.resolve([])
    ]);

    res.json({ success: true, stationId, predictions: series, highLow: hilo });
  } catch (err: any) {
    console.error('[Tides] Data fetch error:', err.message);
    res.status(500).send('Failed to fetch tidal data');
  }
});

app.get('/api/frigate/servers', (_req, res) => {
  res.json({ success: true, servers: persistentServers });
});

app.post('/api/frigate/servers', (req, res) => {
  const { servers } = req.body;
  if (Array.isArray(servers)) {
    persistentServers = servers;
    try {
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(persistentServers, null, 2));
    } catch (err) {}
  }
  res.json({ success: true, servers: persistentServers });
});

app.get('/api/birds/proxy/audio/:id', async (req, res) => {
  const { id } = req.params;
  const { serverUrl } = req.query;
  if (!serverUrl || !id) return res.status(400).send('Missing params');
  try {
    const fullUrl = `${(serverUrl as string).replace(/\/$/, '')}/api/v2/audio/${id}`;
    const audioResp = await fetch(fullUrl);
    if (!audioResp.ok) {
      const fallbackUrl = `${(serverUrl as string).replace(/\/$/, '')}/api/v2/media/audio?id=${id}`;
      const fallbackResp = await fetch(fallbackUrl);
      if (!fallbackResp.ok) return res.status(404).send('Not found');
      res.setHeader('Content-Type', 'audio/wav');
      return res.send(Buffer.from(await fallbackResp.arrayBuffer()));
    }
    res.setHeader('Content-Type', 'audio/wav');
    res.send(Buffer.from(await audioResp.arrayBuffer()));
  } catch (err: any) {
    res.status(502).send('Error');
  }
});

app.get('/api/birds/proxy/live-audio', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing RTSP URL');
  const rtspUrl = url as string;
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const ffmpeg = spawn('ffmpeg', [
    '-loglevel', 'error',
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-vn',
    '-acodec', 'libmp3lame',
    '-ab', '128k',
    '-ar', '44100',
    '-f', 'mp3',
    'pipe:1'
  ]);

  ffmpeg.stdout.pipe(res);
  ffmpeg.on('exit', () => { if (!res.writableEnded) res.end(); });
  ffmpeg.on('error', () => { if (!res.headersSent) res.status(500).send('FFmpeg failed'); });
  req.on('close', () => { ffmpeg.kill('SIGKILL'); });
});

const app = express();
app.use(express.json());

app.get('/api/frigate/proxy/image', async (req, res) => {
  const { serverUrl, path: targetPath } = req.query;
  if (!serverUrl || !targetPath) return res.status(400).send('Missing params');
  try {
    const fullUrl = `${(serverUrl as string).replace(/\/$/, '')}${targetPath as string}`;
    const imgResp = await fetch(fullUrl);
    if (!imgResp.ok) return res.status(imgResp.status).send('Failed');
    res.setHeader('Content-Type', imgResp.headers.get('content-type') || 'image/jpeg');
    res.send(Buffer.from(await imgResp.arrayBuffer()));
  } catch (err: any) {
    res.status(502).send('Error');
  }
});

app.get('/api/frigate/proxy/stream', async (req, res) => {
  const { serverUrl, camera, fps, h } = req.query;
  if (!serverUrl || !camera) return res.status(400).send('Missing params');
  try {
    const streamUrl = `${(serverUrl as string).replace(/\/$/, '')}/api/${camera}?fps=${fps || 10}&h=${h || 720}`;
    const streamResp = await fetch(streamUrl);
    if (!streamResp.ok) return res.status(streamResp.status).send('Unavailable');
    res.setHeader('Content-Type', streamResp.headers.get('content-type') || 'multipart/x-mixed-replace; boundary=frame');
    if (streamResp.body) {
      const reader = (streamResp.body as any).getReader();
      const push = async () => {
        const { done, value } = await reader.read();
        if (done || req.destroyed) return;
        res.write(value);
        push();
      };
      push();
      req.on('close', () => reader.cancel());
    }
  } catch (err: any) {
    res.status(502).send('Error');
  }
});

app.get('/api/frigate/proxy/events/:id/clip.mp4', async (req, res) => {
  const { id } = req.params;
  const { serverUrl } = req.query;
  if (!serverUrl) return res.status(400).send('Missing serverUrl');
  try {
    const clipUrl = `${(serverUrl as string).replace(/\/$/, '')}/api/events/${id}/clip.mp4`;
    const clipResp = await fetch(clipUrl);
    if (!clipResp.ok) return res.status(clipResp.status).send('Not found');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline');
    if (clipResp.body) {
      const patcher = new HevcPatchStream();
      Readable.from(clipResp.body as any).pipe(patcher).pipe(res);
    }
  } catch (err: any) {
    res.status(502).send('Error');
  }
});

if (persistentSettings.birdnet?.enabled) connectToBirdMqtt();

app.post('/api/notifications/settings', (req, res) => {
  const { settings } = req.body;
  if (settings) {
    const birdnetChanged = JSON.stringify(persistentSettings.birdnet) !== JSON.stringify(settings.birdnet);
    persistentSettings = settings;
    savePersistentSettings();
    if (birdnetChanged) connectToBirdMqtt();
  }
  res.json({ success: true, settings: persistentSettings });
});

app.get('/api/notifications/settings', (req, res) => {
  res.json({ success: true, settings: persistentSettings });
});

app.get('/api/birds/sightings', (_req, res) => {
  res.json({ success: true, sightings: birdSightings });
});

app.post('/api/birds/clear', (_req, res) => {
  birdSightings = [];
  saveBirdSightings();
  res.json({ success: true });
});

app.get('/api/birds/status', (_req, res) => {
  res.json({ success: true, status: birdMqttStatus, config: persistentSettings.birdnet });
});

app.get('/api/notifications/logs', (_req, res) => {
  res.json({ success: true, logs: [] });
});

app.post('/api/notifications/clear-logs', (_req, res) => {
  res.json({ success: true });
});

app.post('/api/notifications/test', async (req, res) => {
  res.json({ success: true, result: { message: 'Test mode simulation successful' } });
});

app.post('/api/notifications/dispatch', async (req, res) => {
  const { event, settings } = req.body;
  const result = await dispatchNotification(event, settings);
  res.json(result);
});

app.get('/api/frigate/stats', async (req, res) => {
  const { serverUrl, apiKey } = req.query;
  if (!serverUrl) return res.status(400).send('Missing serverUrl');
  try {
    const url = `${(serverUrl as string).replace(/\/$/, '')}/api/stats`;
    const headers: any = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(url, { headers });
    const data = await resp.json();
    res.json({ success: true, telemetry: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/frigate/servers/fetch-config', async (req, res) => {
  const { url, apiKey } = req.body;
  try {
    const baseUrl = url.replace(/\/$/, '');
    const headers: any = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(`${baseUrl}/api/config`, { headers });
    const config = await resp.json();
    res.json({ success: true, cameras: [], config });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/frigate/servers/fetch-events', async (req, res) => {
  const { url, apiKey } = req.body;
  try {
    const baseUrl = url.replace(/\/$/, '');
    const headers: any = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(`${baseUrl}/api/events`, { headers });
    const events = await resp.json();
    res.json({ success: true, events });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/frigate/mqtt/connect', (req, res) => {
  res.json({ success: true, message: 'MQTT connect called' });
});

app.get('/api/frigate/mqtt/status', (_req, res) => {
  res.json({ success: true, status: { connected: true, brokerUrl: 'mqtt://localhost', messageCount: 0 } });
});

app.get('/api/frigate/mqtt/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('data: {"type":"status","status":{"connected":true}}\n\n');
});

async function dispatchNotification(event: any, settings: any) {
  return { success: true, dispatched: ['simulation'] };
}

function broadcastToSse(data: any) {}

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Frigate Guardian Active on port ${PORT}`); });
