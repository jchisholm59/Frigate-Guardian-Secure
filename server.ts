import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import mqtt, { type MqttClient } from 'mqtt';
import { Transform, Readable } from 'stream';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(process.env.HOME || '/tmp', '.frigate-guardian');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, 'notification_settings.json');
const SERVERS_FILE = path.join(DATA_DIR, 'frigate_servers.json');

let persistentSettings: any = { gmail: { enabled: false }, slack: { enabled: false }, filters: { minImportance: 'all', targetLabels: [] } };
let persistentServers: any[] = [];
const sseClients = new Set<any>();

try {
  if (fs.existsSync(SETTINGS_FILE)) persistentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  if (fs.existsSync(SERVERS_FILE)) persistentServers = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8'));
} catch (e) {}

const app = express();
app.use(express.json());

app.post('/api/frigate/servers/fetch-config', async (req, res) => {
  const { url, apiKey } = req.body;
  try {
    const h: any = {}; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(`${url.replace(/\/$/, '')}/api/config`, { headers: h });
    const config = await resp.json();
    const cams = Object.entries(config.cameras || {}).map(([id, cfg]: [string, any]) => ({
      id, name: id.toUpperCase(), resolution: '1280x720', fps: 5, status: 'online', detectEnabled: true, recordEnabled: true, zones: [], motionMasks: [], streamType: 'main',
      mjpegStreamUrl: `/api/frigate/proxy/stream?serverUrl=${encodeURIComponent(url)}&camera=${encodeURIComponent(id)}`,
      liveImageUrl: `/api/frigate/proxy/image?serverUrl=${encodeURIComponent(url)}&path=${encodeURIComponent(`/api/${id}/latest.jpg`)}`,
      frigate_url: url
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

app.get('/api/frigate/mqtt/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  sseClients.add(res); req.on('close', () => sseClients.delete(res));
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => res.sendFile(path.join(ROOT_DIR, 'dist', 'index.html')));
} else {
  createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
    app.use(vite.middlewares);
  });
}

app.listen(3000, () => console.log('🚀 Guardian Online'));
