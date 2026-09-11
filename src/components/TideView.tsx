import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TidalConfig,
  TidalStation,
  TidalDataPoint,
  TidalExtreme,
  TidalStationReadout,
} from '../types';
import { getSunMoon } from '../utils/astro';
import {
  Waves,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Info,
  ExternalLink,
  MapPin,
  Sunrise,
  Sunset,
  Anchor,
  Settings,
  Clock,
} from 'lucide-react';

interface TideViewProps {
  config?: TidalConfig;
  onGoToSettings: () => void;
}

const M_TO_FT = 3.28084;

export const TideView: React.FC<TideViewProps> = ({ config, onGoToSettings }) => {
  const stations = config?.stations ?? [];
  const units = config?.units ?? 'm';

  const [activeIdx, setActiveIdx] = useState(0);
  const [readout, setReadout] = useState<TidalStationReadout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());

  const activeStation: TidalStation | undefined = stations[Math.min(activeIdx, stations.length - 1)];

  const fetchData = useCallback(async (stationId: string, force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/tides/data/${stationId}${force ? '?force=1' : ''}`);
      const data = (await resp.json()) as TidalStationReadout;
      if (data.success) {
        setReadout(data);
      } else {
        setError(data.error || 'Failed to load tidal data');
        setReadout(null);
      }
    } catch {
      setError('Network error loading tidal data');
      setReadout(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeStation) fetchData(activeStation.id);
    else setReadout(null);
  }, [activeStation?.id, fetchData]);

  // Re-render the "now" marker / countdowns each minute.
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const convert = (m: number) => (units === 'ft' ? m * M_TO_FT : m);
  const unitLabel = units === 'ft' ? 'ft' : 'm';

  const sunMoon = useMemo(() => {
    if (!activeStation) return null;
    return getSunMoon(new Date(tick), activeStation.latitude, activeStation.longitude);
  }, [activeStation?.id, activeStation?.latitude, activeStation?.longitude, tick]);

  const nextExtreme = useMemo(() => {
    if (!readout) return null;
    const now = Date.now();
    return readout.highLow.find((e) => new Date(e.eventDate).getTime() > now) ?? null;
  }, [readout, tick]);

  if (stations.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center bg-slate-900/40 rounded-[2.5rem] border border-dashed border-slate-800 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 mb-6 shadow-inner">
          <Waves className="w-10 h-10 text-slate-700" />
        </div>
        <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm">No Tidal Stations Configured</h3>
        <p className="text-slate-600 text-[10px] mt-2 max-w-[260px] uppercase font-bold tracking-widest leading-relaxed">
          Add up to four Canadian Hydrographic Service stations to monitor tide predictions and receive high / low tide alerts.
        </p>
        <button
          onClick={onGoToSettings}
          className="mt-6 flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-widest transition-all"
        >
          <Settings className="w-4 h-4" />
          <span>Configure Stations</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Station selector */}
      <div className="flex flex-wrap items-center gap-2">
        {stations.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => setActiveIdx(idx)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              idx === activeIdx
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {s.name}
          </button>
        ))}
        <button
          onClick={onGoToSettings}
          title="Configure stations"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={() => activeStation && fetchData(activeStation.id, true)}
          title="Refresh predictions"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-all ml-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {isLoading && !readout ? (
        <div className="py-32 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scanning Oceanic Telemetry…</p>
        </div>
      ) : error ? (
        <div className="p-10 text-center bg-red-950/20 border border-red-500/20 rounded-3xl">
          <Info className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-sm font-bold text-red-400 uppercase">{error}</p>
          <button
            onClick={() => activeStation && fetchData(activeStation.id, true)}
            className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : readout && activeStation ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <TideChart
              data={readout.predictions}
              highLow={readout.highLow}
              convert={convert}
              unitLabel={unitLabel}
              nowMs={tick}
            />

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Upcoming High &amp; Low Tides</h3>
              </div>

              {readout.highLow.length === 0 ? (
                <p className="text-xs text-slate-600 uppercase font-bold tracking-widest">No predictions in range.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {readout.highLow.map((item, idx) => {
                    const isHigh = item.type === 'high';
                    const when = new Date(item.eventDate);
                    const isPast = when.getTime() < tick;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-4 rounded-2xl bg-slate-950/40 border ${
                          isPast ? 'border-slate-800/50 opacity-40' : 'border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isHigh ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                            {isHigh ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-500">{isHigh ? 'High Tide' : 'Low Tide'}</p>
                            <p className="text-sm font-black text-white">
                              {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-white">
                            {convert(item.value).toFixed(2)}
                            <span className="text-[10px] text-slate-500 ml-1">{unitLabel}</span>
                          </p>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                            {when.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {nextExtreme && (
              <div className="bg-gradient-to-br from-cyan-950/60 to-slate-900 border border-cyan-500/30 rounded-3xl p-6 shadow-xl">
                <p className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.25em] mb-2">Next {nextExtreme.type} tide</p>
                <p className="text-3xl font-black text-white">{countdown(nextExtreme.eventDate, tick)}</p>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  {new Date(nextExtreme.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                  {convert(nextExtreme.value).toFixed(2)} {unitLabel}
                </p>
              </div>
            )}

            {sunMoon && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-5">Sun &amp; Moon</h3>
                <div className="grid grid-cols-2 gap-3">
                  <SunMoonStat icon={<Sunrise className="w-4 h-4" />} label="Sunrise" value={fmtClock(sunMoon.sunrise)} tint="text-amber-400" />
                  <SunMoonStat icon={<Sunset className="w-4 h-4" />} label="Sunset" value={fmtClock(sunMoon.sunset)} tint="text-orange-400" />
                </div>
                <div className="mt-4 flex items-center gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
                  <MoonGlyph phase={sunMoon.moonPhase} />
                  <div>
                    <p className="text-sm font-black text-white">{sunMoon.moonPhaseName}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {Math.round(sunMoon.moonIllumination * 100)}% illuminated
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-400">
                  <Anchor className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Station Intel</h3>
              </div>
              <div className="space-y-5">
                <IntelRow label="Station" value={activeStation.name} />
                <IntelRow label="CHS Code" value={activeStation.code || '—'} mono />
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Position</span>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-xs font-bold text-slate-400">
                      {activeStation.latitude.toFixed(4)}, {activeStation.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
                <IntelRow label="Data Age" value={`${Math.max(0, Math.round((tick - readout.fetchedAt) / 60000))} min`} />
                <div className="pt-4 border-t border-slate-800">
                  <a
                    href={`https://tides.gc.ca/en/stations/${activeStation.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-xs font-black uppercase tracking-widest"
                  >
                    <span>Official CHS Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// --- helpers ---

function fmtClock(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function countdown(iso: string, nowMs: number): string {
  const diff = new Date(iso).getTime() - nowMs;
  if (diff <= 0) return 'now';
  const mins = Math.round(diff / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const IntelRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="space-y-1">
    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
    <p className={`text-sm font-black ${mono ? 'font-mono text-cyan-400' : 'text-white'}`}>{value}</p>
  </div>
);

const SunMoonStat: React.FC<{ icon: React.ReactNode; label: string; value: string; tint: string }> = ({
  icon,
  label,
  value,
  tint,
}) => (
  <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
    <div className={`flex items-center gap-1.5 ${tint}`}>
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-sm font-black text-white mt-1">{value}</p>
  </div>
);

const MoonGlyph: React.FC<{ phase: number }> = ({ phase }) => {
  // Simple lit-fraction disc: shift a shadow circle across a lit circle.
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const waxing = phase < 0.5;
  const offset = (waxing ? 1 : -1) * (1 - lit) * 20;
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10 flex-shrink-0">
      <circle cx="20" cy="20" r="18" fill="#020617" stroke="#1e293b" />
      <clipPath id="moonclip">
        <circle cx="20" cy="20" r="18" />
      </clipPath>
      <g clipPath="url(#moonclip)">
        <circle cx="20" cy="20" r="18" fill="#e2e8f0" />
        <circle cx={20 + offset} cy="20" r="18" fill="#020617" />
      </g>
    </svg>
  );
};

const TideChart: React.FC<{
  data: TidalDataPoint[];
  highLow: TidalExtreme[];
  convert: (m: number) => number;
  unitLabel: string;
  nowMs: number;
}> = ({ data, highLow, convert, unitLabel, nowMs }) => {
  if (data.length < 2) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-10 text-center">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Tide curve unavailable for this station</p>
      </div>
    );
  }

  const width = 800;
  const height = 220;
  const padding = 24;

  const vals = data.map((d) => convert(d.value));
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range = maxVal - minVal || 1;

  const minTime = new Date(data[0].eventDate).getTime();
  const maxTime = new Date(data[data.length - 1].eventDate).getTime();
  const timeRange = maxTime - minTime || 1;

  const getX = (t: number) => ((t - minTime) / timeRange) * (width - 2 * padding) + padding;
  const getY = (v: number) => height - (((v - minVal) / range) * (height - 2 * padding) + padding);

  const pathData = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(new Date(d.eventDate).getTime()).toFixed(1)} ${getY(convert(d.value)).toFixed(1)}`)
    .join(' ');

  const currentX = getX(nowMs);

  // Interpolate current level from the curve
  let currentVal = convert(data[0].value);
  for (let i = 0; i < data.length - 1; i++) {
    const t1 = new Date(data[i].eventDate).getTime();
    const t2 = new Date(data[i + 1].eventDate).getTime();
    if (nowMs >= t1 && nowMs <= t2) {
      const r = (nowMs - t1) / (t2 - t1);
      currentVal = convert(data[i].value) + (convert(data[i + 1].value) - convert(data[i].value)) * r;
      break;
    }
  }

  const inRange = currentX >= padding && currentX <= width - padding;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Predicted Tidal Curve · 30h</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{inRange ? currentVal.toFixed(2) : '—'}</span>
            <span className="text-xs font-bold text-slate-500">{unitLabel} {inRange ? '(now)' : ''}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest">Chart Datum</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400">
            {new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="relative bg-slate-950 rounded-3xl border border-slate-800/50 p-2 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line x1={padding} y1={getY(minVal)} x2={width - padding} y2={getY(minVal)} stroke="#1e293b" strokeDasharray="4 4" />
          <line x1={padding} y1={getY(maxVal)} x2={width - padding} y2={getY(maxVal)} stroke="#1e293b" strokeDasharray="4 4" />

          <path d={`${pathData} L ${getX(maxTime).toFixed(1)} ${height} L ${getX(minTime).toFixed(1)} ${height} Z`} fill="url(#tideGradient)" />
          <path
            d={pathData}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
          />

          {highLow.map((hl, idx) => {
            const x = getX(new Date(hl.eventDate).getTime());
            if (x < padding || x > width - padding) return null;
            const y = getY(convert(hl.value));
            return (
              <g key={idx}>
                <circle cx={x} cy={y} r="3.5" fill={hl.type === 'high' ? '#34d399' : '#60a5fa'} />
                <text x={x} y={hl.type === 'high' ? y - 8 : y + 16} textAnchor="middle" className="fill-slate-500" fontSize="9" fontWeight="700">
                  {convert(hl.value).toFixed(1)}
                </text>
              </g>
            );
          })}

          {inRange && (
            <g>
              <line x1={currentX} y1={0} x2={currentX} y2={height} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <circle cx={currentX} cy={getY(currentVal)} r="5" fill="#fff" />
              <circle cx={currentX} cy={getY(currentVal)} r="10" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
