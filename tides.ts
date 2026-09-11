/**
 * Tide service — DFO / Canadian Hydrographic Service (IWLS) integration.
 *
 * Exposes:
 *   GET  /api/tides/stations/search?q=<name|code>
 *   GET  /api/tides/data/:stationId
 *
 * Plus a background scheduler that fires notifications a configurable number
 * of minutes before each predicted high/low tide, for the stations the user
 * has added under notification settings (`settings.tides`).
 *
 * Kept out of server.ts so the tide feature is self-contained: it does its
 * own SMTP / webhook delivery (mirroring the env-var precedence used by the
 * camera notifier) rather than reaching into that code path.
 */

import type { Express, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const IWLS_BASE = 'https://api-iwls.dfo-mpo.gc.ca/api/v1';
const STATION_LIST_TTL = 6 * 60 * 60 * 1000; // 6h — the station catalogue barely changes
const STATION_DATA_TTL = 10 * 60 * 1000; // 10min — be polite to a public gov API
const HISTORY_HOURS = 3;
const FORECAST_HOURS = 27;

type ExtremeType = 'high' | 'low';

interface RawPoint {
  eventDate: string;
  value: number;
}
interface TypedExtreme extends RawPoint {
  type: ExtremeType;
}

interface StationReadout {
  success: boolean;
  station: {
    id: string;
    code: string;
    name: string;
    latitude: number;
    longitude: number;
    province?: string;
  };
  predictions: RawPoint[];
  highLow: TypedExtreme[];
  fetchedAt: number;
  error?: string;
}

export interface TideServiceDeps {
  /** Returns the full persistent settings object (holds `.tides` and `.gmail`). */
  getSettings: () => any;
  /** Push an event to connected SSE clients. */
  broadcastToSse: (data: any) => void;
}

interface CacheEntry<T> {
  value: T;
  ts: number;
}

export function createTideService(deps: TideServiceDeps) {
  let stationListCache: CacheEntry<any[]> | null = null;
  const stationDataCache = new Map<string, CacheEntry<StationReadout>>();

  // Keys of alerts we've already fired: `${stationId}:${eventDate}:${type}`
  const firedAlerts = new Set<string>();
  let schedulerTimer: ReturnType<typeof setInterval> | null = null;

  async function getStationList(): Promise<any[]> {
    if (stationListCache && Date.now() - stationListCache.ts < STATION_LIST_TTL) {
      return stationListCache.value;
    }
    const resp = await fetch(`${IWLS_BASE}/stations`);
    if (!resp.ok) throw new Error(`IWLS stations HTTP ${resp.status}`);
    const list = (await resp.json()) as any[];
    stationListCache = { value: list, ts: Date.now() };
    return list;
  }

  /** DFO hi/lo points aren't labelled high vs low — infer from neighbours. */
  function classifyExtremes(points: RawPoint[]): TypedExtreme[] {
    const sorted = [...points].sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
    );
    return sorted.map((p, i) => {
      const prev = sorted[i - 1];
      const next = sorted[i + 1];
      let type: ExtremeType;
      if (prev && next) {
        type = p.value >= prev.value && p.value >= next.value ? 'high' : 'low';
      } else if (prev) {
        type = p.value >= prev.value ? 'high' : 'low';
      } else if (next) {
        type = p.value >= next.value ? 'high' : 'low';
      } else {
        type = 'high';
      }
      return { eventDate: p.eventDate, value: p.value, type };
    });
  }

  async function fetchStationData(stationId: string, force = false): Promise<StationReadout> {
    const cached = stationDataCache.get(stationId);
    if (!force && cached && Date.now() - cached.ts < STATION_DATA_TTL) {
      return cached.value;
    }

    const now = Date.now();
    const from = new Date(now - HISTORY_HOURS * 3600_000).toISOString();
    const to = new Date(now + FORECAST_HOURS * 3600_000).toISOString();

    const list = await getStationList().catch(() => [] as any[]);
    const meta = list.find((s) => s.id === stationId);

    const [curveResp, hiloResp] = await Promise.all([
      fetch(
        `${IWLS_BASE}/stations/${stationId}/data?time-series-code=wlp&resolution=FIFTEEN_MINUTES&from=${from}&to=${to}`,
      ),
      fetch(`${IWLS_BASE}/stations/${stationId}/data?time-series-code=wlp-hilo&from=${from}&to=${to}`),
    ]);

    if (!curveResp.ok && !hiloResp.ok) {
      throw new Error(`IWLS data HTTP ${curveResp.status}/${hiloResp.status}`);
    }

    const curveRaw = curveResp.ok ? ((await curveResp.json()) as any[]) : [];
    const hiloRaw = hiloResp.ok ? ((await hiloResp.json()) as any[]) : [];

    const predictions: RawPoint[] = curveRaw
      .filter((d) => typeof d.value === 'number')
      .map((d) => ({ eventDate: d.eventDate, value: d.value }));
    const highLow = classifyExtremes(
      hiloRaw.filter((d) => typeof d.value === 'number').map((d) => ({ eventDate: d.eventDate, value: d.value })),
    );

    const readout: StationReadout = {
      success: true,
      station: {
        id: stationId,
        code: meta?.code ?? '',
        name: meta?.officialName ?? 'Unknown Station',
        latitude: meta?.latitude ?? 0,
        longitude: meta?.longitude ?? 0,
        province: meta?.province,
      },
      predictions,
      highLow,
      fetchedAt: Date.now(),
    };

    stationDataCache.set(stationId, { value: readout, ts: Date.now() });
    return readout;
  }

  // --- Notification delivery (self-contained) ---

  function fmtTime(iso: string): string {
    return new Date(iso).toLocaleString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Halifax',
    });
  }

  async function deliverGmail(subjectLine: string, bodyText: string) {
    const settings = deps.getSettings() || {};
    const g = settings.gmail || {};
    const user = process.env.GMAIL_USER || g.smtpUser;
    const pass = process.env.GMAIL_PASSWORD || g.smtpPassword;
    const to = (process.env.GMAIL_RECIPIENT || g.recipientEmail || '').trim();
    const senderName = process.env.GMAIL_SENDER_NAME || g.senderName || 'Frigate Guardian NVR';
    if (!user || !pass || !to) {
      console.log('[Tides] Gmail alert skipped — SMTP credentials or recipient not configured');
      return;
    }
    const port = Number(g.smtpPort) || 465;
    const transporter = nodemailer.createTransport({
      host: g.smtpHost || 'smtp.gmail.com',
      port,
      secure: g.smtpSecure !== undefined ? Boolean(g.smtpSecure) : port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"${senderName}" <${user}>`,
      to,
      subject: subjectLine,
      text: bodyText,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0d0e10;color:#e5e7eb;padding:24px">
        <div style="max-width:520px;margin:0 auto;background:#1a1c1e;border:1px solid #333;border-radius:8px;overflow:hidden">
          <div style="background:#0e7490;padding:16px 22px"><h1 style="margin:0;font-size:16px;color:#fff;letter-spacing:1px">🌊 TIDE ALERT</h1></div>
          <div style="padding:22px;font-size:14px;line-height:1.6;white-space:pre-line">${bodyText}</div>
          <div style="font-size:11px;color:#71717a;text-align:center;padding:14px;border-top:1px solid #27272a">Frigate Guardian • Canadian Hydrographic Service predictions</div>
        </div></div>`,
    });
    console.log(`[Tides] Gmail alert sent to ${to}`);
  }

  async function deliverWebhook(channel: 'slack' | 'discord', text: string) {
    const settings = deps.getSettings() || {};
    const cfg = settings[channel] || {};
    const url =
      channel === 'slack'
        ? process.env.SLACK_WEBHOOK_URL || cfg.webhookUrl
        : process.env.DISCORD_WEBHOOK_URL || cfg.webhookUrl;
    if (!url || !/^https?:\/\//.test(url)) {
      console.log(`[Tides] ${channel} alert skipped — webhook URL not configured`);
      return;
    }
    const body = channel === 'slack' ? { text } : { content: text };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`${channel} webhook HTTP ${resp.status}`);
    console.log(`[Tides] ${channel} alert sent`);
  }

  async function fireAlert(stationName: string, extreme: TypedExtreme, minutesOut: number) {
    const settings = deps.getSettings() || {};
    const alerts = settings.tides?.alerts;
    if (!alerts?.enabled) return;

    const verb = extreme.type === 'high' ? 'High' : 'Low';
    const summary = `${verb} tide at ${stationName} — ${extreme.value.toFixed(2)} m at ${fmtTime(extreme.eventDate)} (~${minutesOut} min)`;
    console.log(`[Tides] Firing alert: ${summary}`);

    deps.broadcastToSse({ type: 'tide_alert', station: stationName, extreme, minutesOut, summary });

    const channels: string[] = Array.isArray(alerts.channels) ? alerts.channels : [];
    const jobs: Promise<any>[] = [];
    if (channels.includes('gmail')) {
      jobs.push(deliverGmail(`🌊 ${verb} tide soon — ${stationName}`, summary).catch((e) => console.error('[Tides] Gmail alert failed:', e.message)));
    }
    if (channels.includes('slack')) {
      jobs.push(deliverWebhook('slack', `🌊 ${summary}`).catch((e) => console.error('[Tides] Slack alert failed:', e.message)));
    }
    if (channels.includes('discord')) {
      jobs.push(deliverWebhook('discord', `🌊 ${summary}`).catch((e) => console.error('[Tides] Discord alert failed:', e.message)));
    }
    await Promise.all(jobs);
  }

  async function schedulerTick() {
    const settings = deps.getSettings() || {};
    const tides = settings.tides;
    if (!tides?.enabled || !tides.alerts?.enabled) return;

    const stations = Array.isArray(tides.stations) ? tides.stations : [];
    const minutesBefore = Number(tides.alerts.minutesBefore) || 60;
    const wantedEvents: string[] = Array.isArray(tides.alerts.events) ? tides.alerts.events : ['high', 'low'];
    const now = Date.now();

    for (const st of stations) {
      if (!st?.id) continue;
      let readout: StationReadout;
      try {
        readout = await fetchStationData(st.id);
      } catch (e: any) {
        console.error(`[Tides] Scheduler fetch failed for ${st.name || st.id}:`, e.message);
        continue;
      }
      for (const ex of readout.highLow) {
        if (!wantedEvents.includes(ex.type)) continue;
        const key = `${st.id}:${ex.eventDate}:${ex.type}`;
        if (firedAlerts.has(key)) continue;
        const minsOut = (new Date(ex.eventDate).getTime() - now) / 60000;
        if (minsOut > 0 && minsOut <= minutesBefore) {
          firedAlerts.add(key);
          await fireAlert(st.name || readout.station.name, ex, Math.round(minsOut));
        }
      }
    }

    // Prune fired keys for events now well in the past
    for (const key of firedAlerts) {
      const iso = key.split(':').slice(1, -1).join(':');
      if (new Date(iso).getTime() < now - 6 * 3600_000) firedAlerts.delete(key);
    }
  }

  return {
    registerRoutes(app: Express) {
      app.get('/api/tides/stations/search', async (req: Request, res: Response) => {
        const q = String(req.query.q || '').trim().toLowerCase();
        try {
          const list = await getStationList();
          const matches = (q
            ? list.filter(
                (s) =>
                  String(s.officialName || '').toLowerCase().includes(q) ||
                  String(s.code || '').toLowerCase().includes(q),
              )
            : list
          )
            .filter((s) => s.timeSeries?.some((t: any) => t.code === 'wlp-hilo'))
            .slice(0, 25)
            .map((s) => ({
              id: s.id,
              code: s.code,
              name: s.officialName,
              latitude: s.latitude,
              longitude: s.longitude,
              province: s.province,
            }));
          res.json({ success: true, stations: matches });
        } catch (e: any) {
          res.status(502).json({ success: false, error: e.message || 'Station search failed' });
        }
      });

      app.get('/api/tides/data/:stationId', async (req: Request, res: Response) => {
        try {
          const readout = await fetchStationData(
            req.params.stationId,
            String(req.query.force || '') === '1',
          );
          res.json(readout);
        } catch (e: any) {
          res.status(502).json({ success: false, error: e.message || 'Tide data fetch failed' });
        }
      });
    },

    startScheduler() {
      if (schedulerTimer) return;
      // Check once a minute; ticks are cheap thanks to the 10-min data cache.
      schedulerTimer = setInterval(() => {
        schedulerTick().catch((e) => console.error('[Tides] Scheduler tick error:', e));
      }, 60_000);
      console.log('[Tides] Alert scheduler started (60s interval)');
    },

    stopScheduler() {
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
    },
  };
}
