import React, { useEffect, useState } from 'react';
import {
  CloudSun,
  Settings,
  RefreshCw,
  Droplets,
  Wind,
  Gauge,
  Sunrise,
  Sunset,
  Sun,
  Moon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudMoon,
} from 'lucide-react';
import { WeatherConfig, WeatherReadout } from '../types';

interface WeatherViewProps {
  config?: WeatherConfig;
  onGoToSettings: () => void;
}

// WMO weather interpretation codes (used by Open-Meteo) mapped to a label
// and icon. https://open-meteo.com/en/docs — "WMO Weather interpretation codes"
function getWeatherInfo(code: number, isDay: boolean): { label: string; Icon: React.FC<any> } {
  if (code === 0) return { label: 'Clear sky', Icon: isDay ? Sun : Moon };
  if (code === 1) return { label: 'Mainly clear', Icon: isDay ? Sun : Moon };
  if (code === 2) return { label: 'Partly cloudy', Icon: isDay ? CloudSun : CloudMoon };
  if (code === 3) return { label: 'Overcast', Icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Fog', Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', Icon: CloudDrizzle };
  if (code >= 61 && code <= 67) return { label: 'Rain', Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: 'Snow', Icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: 'Rain showers', Icon: CloudRain };
  if (code >= 85 && code <= 86) return { label: 'Snow showers', Icon: CloudSnow };
  if (code >= 95) return { label: 'Thunderstorm', Icon: CloudLightning };
  return { label: 'Unknown', Icon: Cloud };
}

function compassDirection(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

const POLL_INTERVAL_MS = 10 * 60 * 1000; // matches the server's own cache TTL

export const WeatherView: React.FC<WeatherViewProps> = ({ config, onGoToSettings }) => {
  const [readout, setReadout] = useState<WeatherReadout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = Boolean(config?.enabled && config?.homeLat && config?.homeLon);

  const fetchWeather = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/weather/current');
      const data = await resp.json();
      if (data.success) {
        setReadout(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch weather');
      }
    } catch {
      setError('Network error reaching the server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isConfigured) return;
    fetchWeather();
    const interval = setInterval(fetchWeather, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured]);

  if (!isConfigured) {
    return (
      <div className="py-24 flex flex-col items-center justify-center bg-slate-900/40 rounded-[2.5rem] border border-dashed border-slate-800 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 mb-6 shadow-inner">
          <CloudSun className="w-10 h-10 text-slate-700" />
        </div>
        <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm">Weather Not Configured</h3>
        <p className="text-slate-600 text-[10px] mt-2 max-w-[260px] uppercase font-bold tracking-widest leading-relaxed">
          Set your home coordinates to see current conditions and a 7-day forecast.
        </p>
        <button
          onClick={onGoToSettings}
          className="mt-6 flex items-center gap-2 px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black uppercase tracking-widest transition-all"
        >
          <Settings className="w-4 h-4" />
          <span>Configure Weather</span>
        </button>
      </div>
    );
  }

  const current = readout?.current;
  const currentInfo = current ? getWeatherInfo(current.weatherCode, current.isDay) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CloudSun className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-black uppercase tracking-tight text-white">Weather</h2>
          {readout?.timezone && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-300">
              {readout.timezone}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-[10px] uppercase font-bold text-red-400">{error}</span>}
          <button
            onClick={fetchWeather}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onGoToSettings}
            title="Weather settings"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Current conditions */}
      {current && currentInfo && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <currentInfo.Icon className="w-16 h-16 text-sky-400" />
              <div>
                <div className="text-4xl font-black text-white">{Math.round(current.temperatureC)}°C</div>
                <div className="text-sm text-slate-400 font-bold">{currentInfo.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">Feels like {Math.round(current.apparentTemperatureC)}°C</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={<Droplets className="w-3.5 h-3.5" />} label="Humidity" value={`${current.humidityPct}%`} />
              <Stat
                icon={<Wind className="w-3.5 h-3.5" />}
                label="Wind"
                value={`${Math.round(current.windSpeedKmh)} km/h ${compassDirection(current.windDirectionDeg)}`}
              />
              <Stat icon={<Gauge className="w-3.5 h-3.5" />} label="Pressure" value={`${Math.round(current.pressureHpa)} hPa`} />
              <Stat icon={<CloudDrizzle className="w-3.5 h-3.5" />} label="Precip" value={`${current.precipitationMm} mm`} />
            </div>
          </div>
        </div>
      )}

      {/* 7-day forecast */}
      {readout?.daily && readout.daily.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {readout.daily.map((day, idx) => {
            const info = getWeatherInfo(day.weatherCode, true);
            const dayLabel =
              idx === 0
                ? 'Today'
                : new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <div
                key={day.date}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center gap-2"
              >
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">{dayLabel}</span>
                <info.Icon className="w-8 h-8 text-sky-400" />
                <div className="text-xs font-bold text-white">
                  {Math.round(day.highC)}° <span className="text-slate-500 font-normal">/ {Math.round(day.lowC)}°</span>
                </div>
                {day.precipProbabilityPct > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-sky-400 font-mono">
                    <Droplets className="w-3 h-3" />
                    {day.precipProbabilityPct}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sun times for today */}
      {readout?.daily?.[0] && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <Sunrise className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Sunrise</span>
            <span className="text-white font-bold font-mono">
              {new Date(readout.daily[0].sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <Sunset className="w-4 h-4 text-orange-400" />
            <span className="text-slate-400">Sunset</span>
            <span className="text-white font-bold font-mono">
              {new Date(readout.daily[0].sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-sky-900/10 border border-sky-500/20 text-xs text-sky-300">
        <p className="opacity-80 leading-relaxed">
          Data: <span className="font-mono">open-meteo.com</span> — blended forecast models. Cached server-side for 10 minutes.
        </p>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
      {icon}
      <span className="text-[9px] uppercase tracking-wider font-bold">{label}</span>
    </div>
    <div className="text-sm font-black text-white font-mono">{value}</div>
  </div>
);
