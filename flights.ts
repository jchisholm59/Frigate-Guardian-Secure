/**
 * Flight service — live ADS-B aircraft from a local PiAware / dump1090-fa
 * receiver, plus enrichment (photo, aircraft type, origin/destination) from
 * free community APIs (adsbdb.com, planespotters.net).
 *
 * Exposes:
 *   GET  /api/flights/aircraft            — live positions within 300nm of home
 *   GET  /api/flights/detail?hex=&callsign= — photo / aircraft / route lookup
 *   POST /api/flights/test                — validate a candidate aircraft.json URL
 *
 * Kept out of server.ts so the feature is self-contained, mirroring tides.ts.
 * No background scheduler: unlike tide alerts, nothing here needs to run when
 * no one has the Flights tab open.
 */

import type { Express, Request, Response } from 'express';

const EARTH_RADIUS_NM = 3440.065;
const MAX_RANGE_NM = 300;
const DETAIL_TTL = 60 * 60 * 1000; // 1h — registration/route/photo rarely change
const PLANESPOTTERS_USER_AGENT = 'WatchTower/1.0 (+https://github.com/jchisholm59/WatchTower)';

export interface FlightServiceDeps {
  /** Returns the full persistent settings object (holds `.flights`). */
  getSettings: () => any;
}

interface CacheEntry<T> {
  value: T;
  ts: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function createFlightService(deps: FlightServiceDeps) {
  const detailCache = new Map<string, CacheEntry<any>>();

  async function fetchAircraftJson(url: string): Promise<any[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`PiAware HTTP ${resp.status}`);
      const data = await resp.json();
      return Array.isArray(data?.aircraft) ? data.aircraft : [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchAdsbdbAircraft(hex: string) {
    try {
      const resp = await fetch(`https://api.adsbdb.com/v0/aircraft/${hex}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.response?.aircraft ?? null;
    } catch {
      return null;
    }
  }

  async function fetchAdsbdbRoute(callsign: string) {
    try {
      const resp = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.response?.flightroute ?? null;
    } catch {
      return null;
    }
  }

  async function fetchPlanespottersPhoto(hex: string) {
    try {
      const resp = await fetch(`https://api.planespotters.net/pub/photos/hex/${hex}`, {
        headers: { 'User-Agent': PLANESPOTTERS_USER_AGENT },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const photo = data?.photos?.[0];
      if (!photo) return null;
      return {
        url: photo.thumbnail_large?.src || photo.thumbnail?.src,
        photographer: photo.photographer,
        link: photo.link,
      };
    } catch {
      return null;
    }
  }

  return {
    registerRoutes(app: Express) {
      app.get('/api/flights/aircraft', async (_req: Request, res: Response) => {
        const settings = deps.getSettings() || {};
        const cfg = settings.flights || {};
        if (!cfg.piawareUrl) {
          return res.status(400).json({ success: false, error: 'PiAware URL not configured' });
        }
        const homeLat = Number(cfg.homeLat) || 0;
        const homeLon = Number(cfg.homeLon) || 0;

        try {
          const raw = await fetchAircraftJson(cfg.piawareUrl);
          const aircraft = raw
            .filter((a) => typeof a.lat === 'number' && typeof a.lon === 'number')
            .map((a) => {
              const distanceNm = haversineNm(homeLat, homeLon, a.lat, a.lon);
              return {
                hex: a.hex,
                flight: typeof a.flight === 'string' ? a.flight.trim() || null : null,
                lat: a.lat,
                lon: a.lon,
                altitude: a.alt_baro === 'ground' ? 0 : typeof a.alt_baro === 'number' ? a.alt_baro : null,
                onGround: a.alt_baro === 'ground',
                groundSpeed: typeof a.gs === 'number' ? a.gs : null,
                track: typeof a.track === 'number' ? a.track : null,
                squawk: typeof a.squawk === 'string' ? a.squawk : null,
                distanceNm,
                bearing: bearingDeg(homeLat, homeLon, a.lat, a.lon),
                seenSec: typeof a.seen === 'number' ? a.seen : 0,
                seenPosSec: typeof a.seen_pos === 'number' ? a.seen_pos : 0,
              };
            })
            .filter((a) => a.distanceNm <= MAX_RANGE_NM);

          res.json({ success: true, aircraft, homeLat, homeLon });
        } catch (e: any) {
          res.status(502).json({ success: false, error: e.message || 'Failed to reach PiAware receiver' });
        }
      });

      app.get('/api/flights/detail', async (req: Request, res: Response) => {
        const hex = String(req.query.hex || '').trim().toLowerCase();
        const callsign = String(req.query.callsign || '').trim();
        if (!hex) {
          return res.status(400).json({ success: false, error: 'hex is required' });
        }

        const cacheKey = `${hex}:${callsign}`;
        const cached = detailCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < DETAIL_TTL) {
          return res.json(cached.value);
        }

        const [adsbAircraft, route, photo] = await Promise.all([
          fetchAdsbdbAircraft(hex),
          callsign ? fetchAdsbdbRoute(callsign) : Promise.resolve(null),
          fetchPlanespottersPhoto(hex),
        ]);

        const result = {
          success: true,
          aircraft: adsbAircraft
            ? {
                registration: adsbAircraft.registration,
                type: adsbAircraft.type,
                icaoType: adsbAircraft.icao_type,
                manufacturer: adsbAircraft.manufacturer,
              }
            : undefined,
          route: route
            ? {
                airline: route.airline?.name,
                originName: route.origin?.name,
                originIata: route.origin?.iata_code,
                destinationName: route.destination?.name,
                destinationIata: route.destination?.iata_code,
              }
            : undefined,
          photo:
            photo ||
            (adsbAircraft?.url_photo
              ? { url: adsbAircraft.url_photo }
              : undefined),
        };

        detailCache.set(cacheKey, { value: result, ts: Date.now() });
        res.json(result);
      });

      app.post('/api/flights/test', async (req: Request, res: Response) => {
        const url = String(req.body?.piawareUrl || '').trim();
        if (!url) {
          return res.status(400).json({ success: false, error: 'PiAware URL is required' });
        }
        try {
          const aircraft = await fetchAircraftJson(url);
          res.json({ success: true, aircraftCount: aircraft.length });
        } catch (e: any) {
          res.json({ success: false, error: e.message || 'Could not reach that URL' });
        }
      });
    },
  };
}
