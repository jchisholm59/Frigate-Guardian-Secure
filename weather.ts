/**
 * Weather service — Open-Meteo integration (current conditions + 7-day
 * forecast). Free, no API key, takes lat/lon directly.
 *
 * Exposes:
 *   GET /api/weather/current
 *
 * Kept out of server.ts so the feature is self-contained, mirroring
 * tides.ts / flights.ts. No background scheduler — nothing needs to run
 * when the tab isn't open.
 */

import type { Express, Request, Response } from 'express';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL = 10 * 60 * 1000; // 10min — be polite to a free public API

export interface WeatherServiceDeps {
  /** Returns the full persistent settings object (holds `.weather`). */
  getSettings: () => any;
}

interface CacheEntry<T> {
  value: T;
  ts: number;
}

export function createWeatherService(deps: WeatherServiceDeps) {
  const cache = new Map<string, CacheEntry<any>>();

  async function fetchForecast(lat: number, lon: number) {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.value;

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm',
      timezone: 'auto',
      forecast_days: '7',
    });

    const resp = await fetch(`${FORECAST_URL}?${params.toString()}`);
    if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
    const raw = await resp.json();

    const daily = (raw.daily?.time || []).map((date: string, i: number) => ({
      date,
      weatherCode: raw.daily.weather_code[i],
      highC: raw.daily.temperature_2m_max[i],
      lowC: raw.daily.temperature_2m_min[i],
      precipProbabilityPct: raw.daily.precipitation_probability_max[i],
      windSpeedMaxKmh: raw.daily.wind_speed_10m_max[i],
      sunrise: raw.daily.sunrise[i],
      sunset: raw.daily.sunset[i],
    }));

    const readout = {
      success: true,
      current: {
        time: raw.current.time,
        temperatureC: raw.current.temperature_2m,
        apparentTemperatureC: raw.current.apparent_temperature,
        humidityPct: raw.current.relative_humidity_2m,
        precipitationMm: raw.current.precipitation,
        weatherCode: raw.current.weather_code,
        windSpeedKmh: raw.current.wind_speed_10m,
        windDirectionDeg: raw.current.wind_direction_10m,
        pressureHpa: raw.current.surface_pressure,
        isDay: raw.current.is_day === 1,
      },
      daily,
      timezone: raw.timezone,
      fetchedAt: Date.now(),
    };

    cache.set(cacheKey, { value: readout, ts: Date.now() });
    return readout;
  }

  return {
    registerRoutes(app: Express) {
      app.get('/api/weather/current', async (_req: Request, res: Response) => {
        const settings = deps.getSettings() || {};
        const cfg = settings.weather || {};
        const lat = Number(cfg.homeLat);
        const lon = Number(cfg.homeLon);
        if (!lat || !lon) {
          return res.status(400).json({ success: false, error: 'Home coordinates not configured' });
        }
        try {
          const readout = await fetchForecast(lat, lon);
          res.json(readout);
        } catch (e: any) {
          res.status(502).json({ success: false, error: e.message || 'Weather fetch failed' });
        }
      });
    },
  };
}
