import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import mqtt, { type MqttClient } from 'mqtt';
import { Readable, Transform } from 'stream';
import nodemailer from 'nodemailer';
import archiver from 'archiver';

// --- HELPERS ---
const __filename = typeof import.meta.url !== 'undefined' ? fileURLToPath(import.meta.url) : '';
const __dirname = path.dirname(__filename || process.cwd());

dotenv.config();
if (fs.existsSync(path.join(__dirname, 'guardian.env'))) {
  dotenv.config({ path: path.join(__dirname, 'guardian.env'), override: true });
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.frigate-guardian');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, 'notification_settings.json');
const BIRD_SIGHTINGS_FILE = path.join(DATA_DIR, 'bird_sightings.json');
const SERVERS_FILE = path.join(DATA_DIR, 'frigate_servers.json');

// --- H.265 Compatibility Patcher ---
class HevcPatchStream extends Transform {
  private tail: Buffer = Buffer.alloc(0);
  private search: Buffer = Buffer.from('hev1');
  private replace: Buffer = Buffer.from('hvc1');
  _transform(chunk: any, encoding: string, callback: Function) {
    let data = Buffer.concat([this.tail, chunk]);
    let pos = 0;
    while ((pos = data.indexOf(this.search, pos)) !== -1) {
      this.replace.copy(data, pos);
      pos += 4;
    }
    const tailSize = this.search.length - 1;
    if (data.length > tailSize) {
      this.push(data.slice(0, data.length - tailSize));
      this.tail = data.slice(data.length - tailSize);
    } else { this.tail = data; }
    callback();
  }
  _flush(callback: Function) { this.push(this.tail); callback(); }
}

// --- STATE ---
let aiClient: GoogleGenAI | null = null;
let persistentSettings: any = {
  gmail: { enabled: false },
  slack: { enabled: false },
  discord: { enabled: false },
  filters: { minImportance: 'all', minThreatLevel: 'all', targetLabels: [], selectedCameras: [], ignoreParkedCars: true },
  birdnet: { enabled: false, brokerHost: '', port: 1883, topic: 'birdnet-sightings', serverUrl: '', liveAudioUrl: '', sendDailyAlerts: false },
  tides: { stations: [], refreshIntervalMinutes: 60 }
};

let birdSightings: any[] = [];
let persistentServers: any[] = [];
let speciesFactCache: Record<string, string> = {};
let dailyAlertedSpecies = new Set<string>();
let lastBirdAlertReset = new Date().getUTCDate();
const parkedVehicles = new Map<string, { x: number, y: number, timestamp: number }>();
const sseClients = new Set<any>();

// --- PERSISTENCE ---
try {
  if (fs.existsSync(SETTINGS_FILE)) persistentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  if (fs.existsSync(BIRD_SIGHTINGS_FILE)) birdSightings = JSON.parse(fs.readFileSync(BIRD_SIGHTINGS_FILE, 'utf-8'));
  if (fs.existsSync(SERVERS_FILE)) persistentServers = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8'));
} catch (err) { console.error('[Storage] Load failed:', err); }

function saveSettings() { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(persistentSettings, null, 2)); }
function saveBirds() { fs.writeFileSync(BIRD_SIGHTINGS_FILE, JSON.stringify(birdSightings.slice(0, 1000), null, 2)); }
function saveServers() { fs.writeFileSync(SERVERS_FILE, JSON.stringify(persistentServers, null, 2)); }

// --- AI ENGINE ---
function getAiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!aiClient) aiClient = new GoogleGenAI(key);
  return aiClient;
}

// --- SSE BROADCASTER ---
function broadcastToSse(data: any) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => { try { c.write(msg); } catch (e) { sseClients.delete(c); } });
}

// --- NOTIFICATION ENGINE ---
async function dispatchNotification(event: any, settings: any) {
  if (!event || !settings) return { success: false };
  const now = Date.now();
  const vehicleLabels = ['car', 'truck', 'van', 'motorcycle', 'bus'];
  if (settings.filters?.ignoreParkedCars && vehicleLabels.includes(event.label)) {
    const box = event.box || { x: 0.5, y: 0.5, width: 0, height: 0 };
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const key = `${event.camera}_${event.label}`;
    if (event.stationary) { parkedVehicles.set(key, { x: cx, y: cy, timestamp: now }); return { success: true, skipped: true, reason: 'Stationary' }; }
    const last = parkedVehicles.get(key);
    if (last && (now - last.timestamp) < 3600000) {
      const dist = Math.sqrt(Math.pow(cx - last.x, 2) + Math.pow(cy - last.y, 2));
      if (dist < 0.03) return { success: true, skipped: true, reason: 'Jitter' };
    }
  }
  console.log(`[Alert] Triggered: ${event.label} on ${event.camera}`);
  return { success: true, dispatched: ['simulation'] };
}

// --- MQTT (BIRDNET) ---
let birdMqttClient: MqttClient | null = null;
const birdMqttStatus = { connected: false, connecting: false, error: null as string | null };

function connectBirdMqtt() {
  const cfg = persistentSettings.birdnet;
  if (!cfg?.enabled || !cfg?.brokerHost) return;
  if (birdMqttClient) birdMqttClient.end();
  birdMqttStatus.connecting = true;
  birdMqttClient = mqtt.connect(`mqtt://${cfg.brokerHost}:${cfg.port || 1883}`, { username: cfg.username, password: cfg.password, reconnectPeriod: 5000 });

  birdMqttClient.on('connect', () => {
    birdMqttStatus.connected = true;
    birdMqttStatus.connecting = false;
    birdMqttClient?.subscribe(cfg.topic || 'birdnet-sightings');
  });

  birdMqttClient.on('message', async (topic, buf) => {
    try {
      const payload = JSON.parse(buf.toString());
      const commonName = payload.commonName || payload.CommonName;
      if (!commonName) return;

      let funFact = speciesFactCache[commonName];
      if (!funFact) {
        const ai = getAiClient();
        if (ai) {
          try {
            const model = ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
            const result = await model.generateContent(`Interesting behavioral fact about ${commonName} under 20 words.`);
            funFact = result.response.text().trim();
            speciesFactCache[commonName] = funFact;
          } catch (e) {}
        }
      }

      const sighting = {
        id: payload.id || `bird-${Date.now()}`,
        commonName, scientificName: payload.scientificName || 'Unknown', confidence: payload.confidence || 0,
        timestamp: Date.now(), sourceNode: payload.sourceName || 'BirdNET', funFact,
        imageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(commonName)}`,
        audioUrl: cfg.serverUrl ? `/api/birds/proxy/audio/${payload.id}?serverUrl=${encodeURIComponent(cfg.serverUrl)}` : undefined
      };

      birdSightings.unshift(sighting); if (birdSightings.length > 500) birdSightings.pop();
      saveBirds(); broadcastToSse({ type: 'bird_sighting', sighting });

      const today = new Date().getUTCDate();
      if (lastBirdAlertReset !== today) { dailyAlertedSpecies.clear(); lastBirdAlertReset = today; }
      if (!dailyAlertedSpecies.has(commonName) && sighting.confidence > 0.6 && cfg.sendDailyAlerts) {
        dailyAlertedSpecies.add(commonName);
        dispatchNotification(sighting, persistentSettings);
      }
    } catch (e) {}
  });
}

// --- EXPRESS APP ---
const app = express();
app.use(express.json());

// Tides Search
app.get('/api/tides/stations/search', async (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  try {
    const resp = await fetch('https://api-iwls.dfo-mpo.gc.ca/api/v1/stations');
    const stations: any[] = await resp.json();
    const filtered = stations.filter(s =>
      String(s.officialName || s.name || '').toLowerCase().includes(q) ||
      String(s.code || '').toLowerCase().includes(q)
    ).slice(0, 15);
    res.json({ success: true, stations: filtered });
  } catch (e) { res.status(500).json({ error: 'Search failed' }); }
});

// Tides Data
app.get('/api/tides/data/:id', async (req, res) => {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 6*3600000).toISOString();
    const to = new Date(now.getTime() + 24*3600000).toISOString();
    const [sR, hR] = await Promise.all([
      fetch(`https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/${req.params.id}/data?timeSeriesCode=wlp&from=${from}&to=${to}`),
      fetch(`https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/${req.params.id}/data?timeSeriesCode=wlp-hilo&from=${from}&to=${to}`)
    ]);
    const [s, h] = await Promise.all([
      sR.ok ? sR.json() : Promise.resolve([]),
      hR.ok ? hR.json() : Promise.resolve([])
    ]);
    res.json({ success: true, predictions: s, highLow: h });
  } catch (e) { res.status(500).json({ error: 'Fetch failed' }); }
});

// Frigate Proxies
app.post('/api/frigate/servers/fetch-config', async (req, res) => {
  const { url, apiKey } = req.body;
  if (!url) return res.status(400).send('URL required');
  try {
    const h: any = {}; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    const baseUrl = url.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/api/config`, { headers: h });
    if (!resp.ok) throw new Error(`Frigate Error ${resp.status}`);
    const config = await resp.json();

    const detectedCameras = Object.entries(config.cameras || {}).map(([camId, camConfig]: [string, any]) => {
      const w = camConfig.detect?.width || 1280; const h_ = camConfig.detect?.height || 720; const fps = camConfig.detect?.fps || 5;
      const zones = Object.entries(camConfig.zones || {}).map(([zName, zCfg]: [string, any], idx) => ({
        id: `zone-${camId}-${zName}`, name: zName, color: ['#38bdf8', '#eab308', '#ec4899', '#10b981', '#a855f7'][idx % 5],
        points: (zCfg.coordinates || "").split(',').reduce((acc: any, val: string, i: number, arr: string[]) => {
          if (i % 2 === 0) acc.push([parseFloat(val), parseFloat(arr[i+1])]);
          return acc;
        }, []),
        objects: zCfg.objects || ['person', 'car']
      }));

      return {
        id: camId, name: camId.toUpperCase(), resolution: `${w}x${h_}`, fps, status: 'online', detectEnabled: true, recordEnabled: true, zones, motionMasks: [],
        mjpegStreamUrl: `/api/frigate/proxy/stream?serverUrl=${encodeURIComponent(baseUrl)}&camera=${encodeURIComponent(camId)}&fps=${fps}&h=720`,
        liveImageUrl: `/api/frigate/proxy/image?serverUrl=${encodeURIComponent(baseUrl)}&path=${encodeURIComponent(`/api/${camId}/latest.jpg?h=720`)}`,
        frigate_url: baseUrl, streamingMode: 'mjpeg'
      };
    });
    res.json({ success: true, cameras: detectedCameras, config });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/frigate/servers/fetch-events', async (req, res) => {
  const { url, apiKey } = req.body;
  try {
    const h: any = {}; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(`${url.replace(/\/$/, '')}/api/events?limit=50&has_clip=1`, { headers: h });
    const events = await resp.json();
    const normalized = events.map((e: any) => ({
      id: e.id, camera: e.camera, label: e.label, score: e.top_score || 0.85,
      startTime: Math.round(e.start_time * 1000), duration: Math.round(e.end_time - e.start_time),
      reviewed: false, hasSnapshot: true, hasClip: true, importance: 'alert',
      box: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
      snapshotUrl: `/api/frigate/proxy/image?serverUrl=${encodeURIComponent(url)}&path=${encodeURIComponent(`/api/events/${e.id}/snapshot.jpg`)}`,
      clipUrl: `/api/frigate/proxy/events/${e.id}/clip.mp4?serverUrl=${encodeURIComponent(url)}`
    }));
    res.json({ success: true, events: normalized });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/frigate/proxy/stream', async (req, res) => {
  const { serverUrl, camera, fps, h } = req.query;
  try {
    const streamUrl = `${(serverUrl as string).replace(/\/$/, '')}/api/${camera}?fps=${fps || 10}&h=${h || 720}`;
    const sResp = await fetch(streamUrl);
    res.setHeader('Content-Type', sResp.headers.get('content-type') || 'multipart/x-mixed-replace; boundary=frame');
    if (sResp.body) {
      const reader = (sResp.body as any).getReader();
      const push = async () => {
        const { done, value } = await reader.read();
        if (done || req.destroyed) return;
        res.write(value); push();
      };
      push(); req.on('close', () => reader.cancel());
    }
  } catch (e) { res.status(502).send('Error'); }
});

app.get('/api/frigate/proxy/image', async (req, res) => {
  const { serverUrl, path: tP } = req.query;
  try {
    const imgResp = await fetch(`${(serverUrl as string).replace(/\/$/, '')}${tP as string}`);
    res.setHeader('Content-Type', imgResp.headers.get('content-type') || 'image/jpeg');
    res.send(Buffer.from(await imgResp.arrayBuffer()));
  } catch (e) { res.status(502).send('Error'); }
});

app.get('/api/frigate/proxy/events/:id/clip.mp4', async (req, res) => {
  const { id } = req.params; const { serverUrl } = req.query;
  try {
    const clipResp = await fetch(`${(serverUrl as string).replace(/\/$/, '')}/api/events/${id}/clip.mp4`);
    res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Content-Disposition', 'inline');
    if (clipResp.body) { const patcher = new HevcPatchStream(); Readable.from(clipResp.body as any).pipe(patcher).pipe(res); }
  } catch (e) { res.status(502).send('Error'); }
});

app.get('/api/frigate/stats', async (req, res) => {
  const { serverUrl, apiKey } = req.query;
  try {
    const h: any = {}; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(`${(serverUrl as string).replace(/\/$/, '')}/api/stats`, { headers: h });
    res.json({ success: true, telemetry: await resp.json() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/frigate/mqtt/status', (_req, res) => res.json({ success: true, status: { connected: true, brokerUrl: 'Active', messageCount: 0 } }));
app.post('/api/frigate/mqtt/connect', (req, res) => res.json({ success: true }));

app.get('/api/notifications/settings', (req, res) => res.json({ success: true, settings: persistentSettings }));
app.post('/api/notifications/settings', (req, res) => {
  const { settings } = req.body; if (settings) {
    const bC = JSON.stringify(persistentSettings.birdnet) !== JSON.stringify(settings.birdnet);
    persistentSettings = settings; saveSettings(); if (bC) connectBirdMqtt();
  }
  res.json({ success: true });
});

app.get('/api/birds/sightings', (req, res) => res.json({ success: true, sightings: birdSightings }));
app.get('/api/birds/status', (req, res) => res.json({ success: true, status: birdMqttStatus, config: persistentSettings.birdnet }));
app.get('/api/frigate/servers', (req, res) => res.json({ success: true, servers: persistentServers }));
app.post('/api/frigate/servers', (req, res) => { if (Array.isArray(req.body.servers)) { persistentServers = req.body.servers; saveServers(); } res.json({ success: true }); });

app.get('/api/frigate/mqtt/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  sseClients.add(res); req.on('close', () => sseClients.delete(res));
});

app.get('/api/notifications/logs', (_req, res) => res.json({ success: true, logs: [] }));
app.post('/api/notifications/clear-logs', (_req, res) => res.json({ success: true }));
app.post('/api/notifications/test', (req, res) => res.json({ success: true }));

app.get('/api/birds/proxy/audio/:id', async (req, res) => {
  const { id } = req.params; const { serverUrl } = req.query;
  try {
    const b = (serverUrl as string).replace(/\/$/, '');
    let r = await fetch(`${b}/api/v2/audio/${id}`);
    if (!r.ok) r = await fetch(`${b}/api/v2/media/audio?id=${id}`);
    res.setHeader('Content-Type', 'audio/wav'); res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.status(502).send('Error'); }
});

app.get('/api/birds/proxy/live-audio', (req, res) => {
  const { url } = req.query; res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Connection', 'keep-alive');
  const f = spawn('ffmpeg', ['-loglevel', 'error', '-rtsp_transport', 'tcp', '-i', url as string, '-vn', '-acodec', 'libmp3lame', '-ab', '128k', '-ar', '44100', '-f', 'mp3', 'pipe:1']);
  f.stdout.pipe(res); req.on('close', () => f.kill('SIGKILL'));
});

// --- START ---
async function start() {
  if (persistentSettings.birdnet?.enabled) connectBirdMqtt();
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Guardian Active on port ${PORT}`));
}

start().catch(console.error);
