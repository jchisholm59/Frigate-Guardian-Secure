import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import mqtt, { type MqttClient } from 'mqtt';
import { Readable, Transform } from 'stream';
import nodemailer from 'nodemailer';

// --- HELPERS ---
const __filename = typeof import.meta.url !== 'undefined' ? fileURLToPath(import.meta.url) : '';
const __dirname_base = path.dirname(__filename || process.cwd());

dotenv.config();
if (fs.existsSync(path.join(__dirname_base, 'guardian.env'))) {
  dotenv.config({ path: path.join(__dirname_base, 'guardian.env'), override: true });
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '/tmp', '.frigate-guardian');
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
  birdnet: { enabled: false, brokerHost: '', port: 1883, topic: 'birdnet-sightings', serverUrl: '', liveAudioUrl: '', sendDailyAlerts: false }
};

let birdSightings: any[] = [];
let persistentServers: any[] = [];
let speciesFactCache: Record<string, string> = {};
const sseClients = new Set<any>();
const parkedVehicles = new Map<string, { x: number, y: number, timestamp: number }>();

// --- PERSISTENCE ---
try {
  if (fs.existsSync(SETTINGS_FILE)) persistentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  if (fs.existsSync(BIRD_SIGHTINGS_FILE)) birdSightings = JSON.parse(fs.readFileSync(BIRD_SIGHTINGS_FILE, 'utf-8'));
  if (fs.existsSync(SERVERS_FILE)) persistentServers = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8'));
} catch (e) {}

function saveSettings() { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(persistentSettings, null, 2)); }
function saveBirds() { fs.writeFileSync(BIRD_SIGHTINGS_FILE, JSON.stringify(birdSightings.slice(0, 1000), null, 2)); }
function saveServers() { fs.writeFileSync(SERVERS_FILE, JSON.stringify(persistentServers, null, 2)); }

function getAiClient() {
  if (aiClient) return aiClient;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  aiClient = new GoogleGenAI(key);
  return aiClient;
}

function broadcastToSse(data: any) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => { try { c.write(msg); } catch (e) { sseClients.delete(c); } });
}

// --- MQTT BirdNET ---
let birdMqttClient: MqttClient | null = null;
const birdMqttStatus = { connected: false, connecting: false, error: null as string | null };

function connectBirdMqtt() {
  const cfg = persistentSettings.birdnet;
  if (!cfg?.enabled || !cfg?.brokerHost) return;
  if (birdMqttClient) birdMqttClient.end();
  birdMqttStatus.connecting = true;
  birdMqttClient = mqtt.connect(`mqtt://${cfg.brokerHost}:${cfg.port || 1883}`, { username: cfg.username, password: cfg.password, reconnectPeriod: 5000 });
  birdMqttClient.on('connect', () => { birdMqttStatus.connected = true; birdMqttStatus.connecting = false; birdMqttClient?.subscribe(cfg.topic || 'birdnet-sightings'); });
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
        audioUrl: cfg.serverUrl ? `${cfg.serverUrl}/api/v2/audio/${payload.id}` : undefined
      };

      birdSightings.unshift(sighting); if (birdSightings.length > 500) birdSightings.pop();
      saveBirds(); broadcastToSse({ type: 'bird_sighting', sighting });
    } catch (e) {}
  });
}

const app = express();
app.use(express.json());

// --- ENDPOINTS ---
app.post('/api/frigate/servers/fetch-config', async (req, res) => {
  const { url, apiKey } = req.body;
  if (!url) return res.status(400).send('URL required');
  try {
    const h: any = {}; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    const baseUrl = url.replace(/\/$/, '');
    const resp = await fetch(`${baseUrl}/api/config`, { headers: h });
    const config = await resp.json();
    const cams = Object.entries(config.cameras || {}).map(([id, cfg]: [string, any]) => {
      const zones = Object.entries(cfg.zones || {}).map(([zN, zC]: [string, any], idx) => ({
        id: `z-${id}-${zN}`, name: zN, color: ['#38bdf8', '#eab308', '#10b981', '#ec4899', '#a855f7'][idx % 5],
        points: (zC.coordinates || "").split(',').reduce((acc: any, v: string, i: number, a: string[]) => {
          if (i % 2 === 0) acc.push([parseFloat(v), parseFloat(a[i+1])]);
          return acc;
        }, []),
        objects: zC.objects || ['person', 'car']
      }));
      return {
        id, name: id.replace(/_/g, ' ').toUpperCase(), resolution: `${cfg.detect?.width || 1280}x${cfg.detect?.height || 720}`, fps: cfg.detect?.fps || 5, status: 'online', detectEnabled: true, recordEnabled: true, zones, motionMasks: [], streamType: 'main', audioEnabled: Boolean(cfg.audio?.enabled),
        mjpegStreamUrl: `/api/frigate/proxy/stream?serverUrl=${encodeURIComponent(baseUrl)}&camera=${encodeURIComponent(id)}`,
        liveImageUrl: `/api/frigate/proxy/image?serverUrl=${encodeURIComponent(baseUrl)}&path=${encodeURIComponent(`/api/${id}/latest.jpg`)}`,
        frigate_url: baseUrl
      };
    });
    res.json({ success: true, cameras: cams, config });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/frigate/servers/fetch-events', async (req, res) => {
  const { url, apiKey } = req.body;
  try {
    const h: any = {}; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(`${url.replace(/\/$/, '')}/api/events?limit=50&has_clip=1`, { headers: h });
    const events = await resp.json();
    const normalized = events.map((e: any) => ({
      id: e.id, camera: e.camera, label: e.label, score: e.top_score || 0.85, startTime: Math.round(e.start_time * 1000), duration: Math.round((e.end_time || e.start_time + 10) - e.start_time), reviewed: false, hasSnapshot: true, hasClip: true, importance: 'alert', box: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
      snapshotUrl: `/api/frigate/proxy/image?serverUrl=${encodeURIComponent(url)}&path=${encodeURIComponent(`/api/events/${e.id}/snapshot.jpg`)}`,
      clipUrl: `/api/frigate/proxy/events/${e.id}/clip.mp4?serverUrl=${encodeURIComponent(url)}`
    }));
    res.json({ success: true, events: normalized });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/frigate/stats', async (req, res) => {
  const { serverUrl, apiKey } = req.query;
  try {
    const h: any = {}; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(`${(serverUrl as string).replace(/\/$/, '')}/api/stats`, { headers: h });
    const data = await resp.json();
    res.json({ success: true, telemetry: {
      uptimeFormatted: data.uptime ? `${Math.floor(data.uptime / 3600)}h ${Math.floor((data.uptime % 3600) / 60)}m` : '0m',
      version: 'Frigate Host', coral: { inferenceSpeedMs: data.service?.inference_speed || 8, temperatureC: data.service?.temperatures?.['usb-0'] || 45, detectionFps: 42 },
      storage: { recordingsUsedGb: 0, recordingsTotalGb: 100 }, cpuPercent: 0, isLive: true
    }});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
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

app.get('/api/notifications/settings', (req, res) => res.json({ success: true, settings: persistentSettings }));
app.post('/api/notifications/settings', (req, res) => {
  if (req.body.settings) { persistentSettings = req.body.settings; saveSettings(); if (persistentSettings.birdnet?.enabled) connectBirdMqtt(); }
  res.json({ success: true });
});

app.get('/api/frigate/servers', (req, res) => res.json({ success: true, servers: persistentServers }));
app.post('/api/frigate/servers', (req, res) => { if (Array.isArray(req.body.servers)) { persistentServers = req.body.servers; saveServers(); } res.json({ success: true }); });

app.get('/api/birds/sightings', (req, res) => res.json({ success: true, sightings: birdSightings }));
app.get('/api/frigate/mqtt/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  sseClients.add(res); req.on('close', () => sseClients.delete(res));
});

// App Startup
const PORT = process.env.PORT || 3000;
if (persistentSettings.birdnet?.enabled) connectBirdMqtt();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => res.sendFile(path.join(ROOT_DIR, 'dist', 'index.html')));
  app.listen(PORT, () => console.log(`🚀 Guardian Active on port ${PORT}`));
} else {
  createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
    app.use(vite.middlewares);
    app.listen(PORT, () => console.log(`🚀 Guardian Active on port ${PORT}`));
  });
}
