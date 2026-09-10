import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import mqtt, { type MqttClient } from 'mqtt';
import { Transform, Readable } from 'stream';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __dirname = path.resolve();
const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '/tmp', '.frigate-guardian');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, 'notification_settings.json');
const BIRD_SIGHTINGS_FILE = path.join(DATA_DIR, 'bird_sightings.json');
const SERVERS_FILE = path.join(DATA_DIR, 'frigate_servers.json');

let persistentSettings: any = {
  gmail: { enabled: false }, slack: { enabled: false }, discord: { enabled: false },
  filters: { minImportance: 'all', minThreatLevel: 'all', targetLabels: [], selectedCameras: [], ignoreParkedCars: true },
  birdnet: { enabled: false, brokerHost: '', port: 1883, topic: 'birdnet-sightings', serverUrl: '', liveAudioUrl: '', sendDailyAlerts: false },
  tides: { stations: [], refreshIntervalMinutes: 60 }
};

let birdSightings: any[] = [];
let persistentServers: any[] = [];
const sseClients = new Set<any>();

try {
  if (fs.existsSync(SETTINGS_FILE)) persistentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  if (fs.existsSync(BIRD_SIGHTINGS_FILE)) birdSightings = JSON.parse(fs.readFileSync(BIRD_SIGHTINGS_FILE, 'utf-8'));
  if (fs.existsSync(SERVERS_FILE)) persistentServers = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8'));
} catch (e) {}

const app = express();
app.use(express.json());

// Tides
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

// Frigate
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
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
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

app.get('/api/frigate/stats', (req, res) => res.json({ success: true, telemetry: { uptimeFormatted: '0m', version: '0.14.1', coral: { inferenceSpeedMs: 8 }, storage: { recordingsUsedGb: 0, recordingsTotalGb: 100 }, cpuPercent: 0 } }));
app.get('/api/frigate/servers', (req, res) => res.json({ success: true, servers: persistentServers }));
app.post('/api/frigate/servers', (req, res) => { if (Array.isArray(req.body.servers)) { persistentServers = req.body.servers; fs.writeFileSync(SERVERS_FILE, JSON.stringify(persistentServers)); } res.json({ success: true }); });

app.get('/api/notifications/settings', (req, res) => res.json({ success: true, settings: persistentSettings }));
app.post('/api/notifications/settings', (req, res) => {
  if (req.body.settings) { persistentSettings = req.body.settings; fs.writeFileSync(SETTINGS_FILE, JSON.stringify(persistentSettings)); }
  res.json({ success: true });
});

app.get('/api/birds/sightings', (req, res) => res.json({ success: true, sightings: birdSightings }));
app.get('/api/frigate/mqtt/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  sseClients.add(res); req.on('close', () => sseClients.delete(res));
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(3000, () => console.log('🚀 Active on 3000'));
