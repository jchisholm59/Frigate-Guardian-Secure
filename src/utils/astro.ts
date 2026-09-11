/**
 * Local astronomical helpers — sunrise / sunset and moon phase.
 *
 * No external dependency: sunrise/sunset use the standard NOAA solar
 * equations, moon phase uses a mean-synodic approximation. Accuracy is
 * ~1 minute for sun times and well within a few percent for lunar
 * illumination, which is plenty for a dashboard readout.
 */

import type { SunMoonInfo } from '../types';

const RAD = Math.PI / 180;

function toJulian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * UTC time (as a Date) of sunrise/sunset for a given calendar day.
 * Returns null when the sun does not rise/set that day (polar day/night).
 */
function sunEvent(date: Date, lat: number, lon: number, isSunrise: boolean): Date | null {
  // Day of year
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);

  const zenith = 90.833; // official, includes refraction + solar disc radius
  const lngHour = lon / 15;
  const t = isSunrise
    ? dayOfYear + (6 - lngHour) / 24
    : dayOfYear + (18 - lngHour) / 24;

  // Sun's mean anomaly
  const M = 0.9856 * t - 3.289;
  // Sun's true longitude
  let L = M + 1.916 * Math.sin(M * RAD) + 0.020 * Math.sin(2 * M * RAD) + 282.634;
  L = ((L % 360) + 360) % 360;

  // Right ascension, kept in the same quadrant as L
  let RA = Math.atan(0.91764 * Math.tan(L * RAD)) / RAD;
  RA = ((RA % 360) + 360) % 360;
  RA += (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90);
  RA /= 15;

  const sinDec = 0.39782 * Math.sin(L * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));

  const cosH = (Math.cos(zenith * RAD) - sinDec * Math.sin(lat * RAD)) / (cosDec * Math.cos(lat * RAD));
  if (cosH > 1 || cosH < -1) return null; // no event this day

  let H = isSunrise ? 360 - Math.acos(cosH) / RAD : Math.acos(cosH) / RAD;
  H /= 15;

  const T = H + RA - 0.06571 * t - 6.622;
  let UT = T - lngHour;
  UT = ((UT % 24) + 24) % 24;

  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCMilliseconds(Math.round(UT * 3600000));
  return result;
}

const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
];

function moonInfo(date: Date): { phase: number; name: string; illumination: number } {
  const synodicMonth = 29.53058867;
  // Reference new moon: 2000-01-06 18:14 UTC (JD 2451550.26)
  const daysSinceNew = toJulian(date) - 2451550.26;
  let phase = (daysSinceNew % synodicMonth) / synodicMonth;
  if (phase < 0) phase += 1;

  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const idx = Math.round(phase * 8) % 8;
  return { phase, name: PHASE_NAMES[idx], illumination };
}

export function getSunMoon(date: Date, lat: number, lon: number): SunMoonInfo {
  const sunrise = sunEvent(date, lat, lon, true);
  const sunset = sunEvent(date, lat, lon, false);
  const moon = moonInfo(date);
  return {
    sunrise: sunrise ? sunrise.toISOString() : null,
    sunset: sunset ? sunset.toISOString() : null,
    moonPhase: moon.phase,
    moonPhaseName: moon.name,
    moonIllumination: moon.illumination,
  };
}
