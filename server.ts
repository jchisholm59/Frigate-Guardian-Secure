import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import mqtt, { type MqttClient } from 'mqtt';
import { Readable, Transform } from 'stream';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// --- CONFIG ---
dotenv.config();
const ROOT_DIR = process.cwd();
const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '/tmp', '.frigate-guardian');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, 'notification_settings.json');
const BIRD_SIGHTINGS_FILE = path.join(DATA_DIR, 'bird_sightings.json');
const SERVERS_FILE = path.join(DATA_DIR, 'frigate_servers.json');

// --- H.265 Mac Compatibility Patcher ---
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
const sseClients = new Set<any>();

// --- PERSISTENCE ---
try {
  if (fs.existsSync(SETTINGS_FILE)) persistentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  if (fs.existsSync(BIRD_SIGHTINGS_FILE)) birdSightings = JSON.parse(fs.readFileSync(BIRD_SIGHTINGS_FILE, 'utf-8'));
  if (fs.existsSync(SERVERS_FILE)) persistentServers = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8'));
} catch (err) {}

function saveSettings() { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(persistentSettings, null, 2)); }
function saveBirds() { fs.writeFileSync(BIRD_SIGHTINGS_FILE, JSON.stringify(birdSightings.slice(0, 1000), null, 2)); }
function saveServers() { fs.writeFileSync(SERVERS_FILE, JSON.stringify(persistentServers, null, 2)); }

function getAiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!aiClient) aiClient = new GoogleGenAI(key);
  return aiClient;
}

function broadcastToSse(data: any) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => { try { c.write(msg); } catch (e) { sseClients.delete(c); } });
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
    birdMqttStatus.connected = true; birdMqttStatus.connecting = false;
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
            const result = await ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' }).generateContent(`Interesting behavioral fact about ${commonName} under 20 words.`);
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
    } catch (e) {}
  });
}

// --- EXPRESS APP ---
const app = express();
app.use(express.json());

app.get('/api/notifications/settings', (req, res) => res.json({ success: true, settings: persistentSettings }));
app.post('/api/notifications/settings', (req, res) => {
  const { settings } = req.body; if (settings) { persistentSettings = settings; saveSettings(); if (settings.birdnet?.enabled) connectBirdMqtt(); }
  res.json({ success: true });
});

app.get('/api/frigate/servers', (req, res) => res.json({ success: true, servers: persistentServers }));
app.post('/api/frigate/servers', (req, res) => { if (Array.isArray(req.body.servers)) { persistentServers = req.body.servers; saveServers(); } res.json({ success: true }); });

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

app.get('/api/tides/data/:id', async (req, res) => {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 6*3600000).toISOString();
    const to = new Date(now.getTime() + 24*3600000).toISOString();
    const [sR, hR] = await Promise.all([
      fetch(`https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/${req.params.id}/data?timeSeriesCode=wlp&from=${from}&to=${to}`),
      fetch(`https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/${req.params.id}/data?timeSeriesCode=wlp-hilo&from=${from}&to=${to}`)
    ]);
    const [s, h] = await Promise.all([ sR.ok ? sR.json() : Promise.resolve([]), hR.ok ? hR.json() : Promise.resolve([]) ]);
    res.json({ success: true, predictions: s, highLow: h });
  } catch (e) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.post('/api/frigate/servers/fetch-config', async (req, res) => {
  const { url, apiKey } = req.body;
  try {
    const h: any = {}; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    const baseUrl = url.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/api/config`, { headers: h });
    const config = await resp.json();
    const cams = Object.entries(config.cameras || {}).map(([id, cfg]: [string, any]) => ({
      id, name: id.toUpperCase(), resolution: '1280x720', fps: 5, status: 'online', detectEnabled: true, recordEnabled: true, zones: [], motionMasks: [], streamType: 'main',
      mjpegStreamUrl: `/api/frigate/proxy/stream?serverUrl=${encodeURIComponent(baseUrl)}&camera=${encodeURIComponent(id)}`,
      liveImageUrl: `/api/frigate/proxy/image?serverUrl=${encodeURIComponent(baseUrl)}&path=${encodeURIComponent(`/api/${id}/latest.jpg`)}`,
      frigate_url: baseUrl
    }));
    res.json({ success: true, cameras: cams });
  } catch (e) { res.status(500).json({ error: 'Discovery failed' }); }
});

app.get('/api/frigate/proxy/stream', async (req, res) => {
  const { serverUrl, camera } = req.query;
  try {
    const sResp = await fetch(`${(serverUrl as string).replace(/\/$/, '')}/api/${camera}`);
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
    res.setHeader('Content-Type', 'image/jpeg');
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

app.get('/api/frigate/mqtt/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  sseClients.add(res); req.on('close', () => sseClients.delete(res));
});

app.get('/api/birds/status', (req, res) => res.json({ success: true, status: birdMqttStatus, config: persistentSettings.birdnet }));

// Static Assets & Vite Integration
const PORT = process.env.PORT || 3000;
if (persistentSettings.birdnet?.enabled) connectBirdMqtt();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => res.sendFile(path.join(ROOT_DIR, 'dist', 'index.html')));
  app.listen(PORT, () => console.log(`🚀 Active on ${PORT}`));
} else {
  createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
    app.use(vite.middlewares);
    app.listen(PORT, () => console.log(`🚀 Active on ${PORT}`));
  });
}
