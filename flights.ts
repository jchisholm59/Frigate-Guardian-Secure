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

// Accepts just a host/IP (the common case — "192.168.1.x") and builds the
// standard PiAware/dump1090-fa SD-card-image path, but passes a full URL
// through unchanged if one was given (covers non-default install layouts,
// e.g. a bare `dump1090-fa` apt install serving from a different path).
function normalizePiawareInput(input: string): string {
  const trimmed = input.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  if (/aircraft\.json(\?|$)/i.test(trimmed)) return trimmed;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return `${withScheme}/skyaware/data/aircraft.json`;
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

const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OPENSKY_LOOKBACK_SEC = 24 * 60 * 60; // 24h — long enough to catch the current/most-recent leg

export function createFlightService(deps: FlightServiceDeps) {
  const detailCache = new Map<string, CacheEntry<any>>();
  let openskyToken: { value: string; expiresAt: number } | null = null;

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

  async function getOpenskyToken(clientId: string, clientSecret: string): Promise<string | null> {
    if (openskyToken && Date.now() < openskyToken.expiresAt) return openskyToken.value;
    try {
      const resp = await fetch(OPENSKY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data.access_token) return null;
      // Refresh a little before actual expiry to avoid racing a stale token.
      openskyToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
      return openskyToken.value;
    } catch {
      return null;
    }
  }

  async function fetchOpenskyRoute(hex: string, callsign: string, clientId: string, clientSecret: string) {
    const token = await getOpenskyToken(clientId, clientSecret);
    if (!token) return null;
    try {
      const end = Math.floor(Date.now() / 1000);
      const begin = end - OPENSKY_LOOKBACK_SEC;
      const resp = await fetch(
        `https://opensky-network.org/api/flights/aircraft?icao24=${hex}&begin=${begin}&end=${end}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) return null;
      const legs = (await resp.json()) as any[];
      if (!Array.isArray(legs) || legs.length === 0) return null;

      // Multiple legs can come back for the lookback window — prefer the one
      // matching the aircraft's current callsign, otherwise the most recent.
      const trimmedCallsign = callsign.trim();
      const matching = trimmedCallsign
        ? legs.filter((l) => String(l.callsign || '').trim() === trimmedCallsign)
        : [];
      const pool = matching.length > 0 ? matching : legs;
      const best = pool.reduce((a, b) => (b.firstSeen > a.firstSeen ? b : a));

      return {
        originIcao: best.estDepartureAirport || undefined,
        destinationIcao: best.estArrivalAirport || undefined,
        departureTime: typeof best.firstSeen === 'number' ? best.firstSeen * 1000 : undefined,
        arrivalTime: typeof best.lastSeen === 'number' ? best.lastSeen * 1000 : undefined,
      };
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
          const raw = await fetchAircraftJson(normalizePiawareInput(cfg.piawareUrl));
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

        const settings = deps.getSettings() || {};
        const cfg = settings.flights || {};
        const openskyClientId = cfg.openskyClientId || '';
        const openskyClientSecret = cfg.openskyClientSecret || '';

        const [adsbAircraft, route, photo, openskyRoute] = await Promise.all([
          fetchAdsbdbAircraft(hex),
          callsign ? fetchAdsbdbRoute(callsign) : Promise.resolve(null),
          fetchPlanespottersPhoto(hex),
          openskyClientId && openskyClientSecret
            ? fetchOpenskyRoute(hex, callsign, openskyClientId, openskyClientSecret)
            : Promise.resolve(null),
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
          route:
            route || openskyRoute
              ? {
                  airline: route?.airline?.name,
                  // Prefer adsbdb's named/IATA route when it has one (mostly
                  // scheduled airline flights); fall back to OpenSky's
                  // ADS-B-derived ICAO airports, which cover far more general
                  // aviation / private / military traffic.
                  originName: route?.origin?.name || openskyRoute?.originIcao,
                  originIata: route?.origin?.iata_code,
                  destinationName: route?.destination?.name || openskyRoute?.destinationIcao,
                  destinationIata: route?.destination?.iata_code,
                  // Only OpenSky ever has actual times — adsbdb never does.
                  departureTime: openskyRoute?.departureTime,
                  arrivalTime: openskyRoute?.arrivalTime,
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
        const input = String(req.body?.piawareUrl || '').trim();
        if (!input) {
          return res.status(400).json({ success: false, error: 'PiAware address is required' });
        }
        const url = normalizePiawareInput(input);
        try {
          const aircraft = await fetchAircraftJson(url);
          res.json({ success: true, aircraftCount: aircraft.length, resolvedUrl: url });
        } catch (e: any) {
          res.json({ success: false, error: e.message || 'Could not reach that URL', resolvedUrl: url });
        }
      });
    },
  };
}
