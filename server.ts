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

// --- CONSTANTS & HELPERS ---
const __filename = typeof import.meta.url !== 'undefined' ? fileURLToPath(import.meta.url) : '';
const __dirname = path.dirname(__filename || process.cwd());

dotenv.config();
if (fs.existsSync(path.join(__dirname, 'guardian.env'))) {
  dotenv.config({ path: path.join(__dirname, 'guardian.env'), override: true });
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.frigate-guardian');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, 'notification_settings.json');
const MQTT_CONFIG_FILE = path.join(DATA_DIR, 'mqtt_config.json');
const BIRD_SIGHTINGS_FILE = path.join(DATA_DIR, 'bird_sightings.json');
const SERVERS_FILE = path.join(DATA_DIR, 'frigate_servers.json');

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
  if (aiClient) return aiClient;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  aiClient = new GoogleGenAI(key);
  return aiClient;
}

// --- SSE BROADCASTER ---
function broadcastToSse(data: any) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => c.write(msg));
}

// --- NOTIFICATION ENGINE ---
const notifiedEvents = new Map<string, number>();
async function dispatchNotification(event: any, settings: any) {
  if (!event || !settings) return { success: false };
  const now = Date.now();

  // Parked Vehicle Filter (Truck/Car Jitter)
  const vehicleLabels = ['car', 'truck', 'van', 'motorcycle', 'bus'];
  if (settings.filters?.ignoreParkedCars && vehicleLabels.includes(event.label)) {
    const box = event.box || { x: 0.5, y: 0.5, width: 0, height: 0 };
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const key = `${event.camera}_${event.label}`;

    if (event.stationary) {
      parkedVehicles.set(key, { x: cx, y: cy, timestamp: now });
      return { success: true, skipped: true, reason: 'Stationary' };
    }
    const last = parkedVehicles.get(key);
    if (last && (now - last.timestamp) < 3600000) {
      const dist = Math.sqrt(Math.pow(cx - last.x, 2) + Math.pow(cy - last.y, 2));
      if (dist < 0.03) return { success: true, skipped: true, reason: 'Jitter' };
    }
  }

  console.log(`[Alert] Dispatching for ${event.label} on ${event.camera}`);
  return { success: true, dispatched: ['simulated'] };
}

// --- MQTT (BIRDNET) ---
let birdMqttClient: MqttClient | null = null;
const birdMqttStatus = { connected: false, connecting: false, error: null as string | null };

function connectBirdMqtt() {
  const cfg = persistentSettings.birdnet;
  if (!cfg?.enabled || !cfg?.brokerHost) return;
  if (birdMqttClient) birdMqttClient.end();
  birdMqttStatus.connecting = true;
  birdMqttClient = mqtt.connect(`mqtt://${cfg.brokerHost}:${cfg.port || 1883}`, { username: cfg.username, password: cfg.password });

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
          const result = await ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' }).generateContent(`Interesting behavioral fact about ${commonName} under 20 words.`);
          funFact = result.response.text().trim();
          speciesFactCache[commonName] = funFact;
        }
      }

      const sighting = {
        id: payload.id || `bird-${Date.now()}`,
        commonName,
        scientificName: payload.scientificName || 'Unknown',
        confidence: payload.confidence || 0,
        timestamp: Date.now(),
        sourceNode: payload.sourceName || 'BirdNET',
        funFact,
        imageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(commonName)}`,
        audioUrl: cfg.serverUrl ? `${cfg.serverUrl}/api/v2/audio/${payload.id}` : undefined
      };

      birdSightings.unshift(sighting);
      if (birdSightings.length > 500) birdSightings.pop();
      saveBirds();
      broadcastToSse({ type: 'bird_sighting', sighting });

      // Daily Species Sentinel Alert
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

app.get('/api/notifications/settings', (req, res) => res.json({ success: true, settings: persistentSettings }));
app.post('/api/notifications/settings', (req, res) => {
  const { settings } = req.body;
  if (settings) {
    const birdnetChanged = JSON.stringify(persistentSettings.birdnet) !== JSON.stringify(settings.birdnet);
    persistentSettings = settings;
    saveSettings();
    if (birdnetChanged) connectBirdMqtt();
  }
  res.json({ success: true });
});

app.get('/api/birds/sightings', (req, res) => res.json({ success: true, sightings: birdSightings }));
app.get('/api/birds/status', (req, res) => res.json({ success: true, status: birdMqttStatus, config: persistentSettings.birdnet }));
app.get('/api/frigate/servers', (req, res) => res.json({ success: true, servers: persistentServers }));
app.post('/api/frigate/servers', (req, res) => {
  if (Array.isArray(req.body.servers)) { persistentServers = req.body.servers; saveServers(); }
  res.json({ success: true });
});

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
    const [s, h] = await Promise.all([
      fetch(`https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/${req.params.id}/data?timeSeriesCode=wlp&from=${from}&to=${to}`).then(r => r.json()),
      fetch(`https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/${req.params.id}/data?timeSeriesCode=wlp-hilo&from=${from}&to=${to}`).then(r => r.json())
    ]);
    res.json({ success: true, predictions: s, highLow: h });
  } catch (e) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.get('/api/frigate/mqtt/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// --- SERVER BOOTSTRAP ---
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
