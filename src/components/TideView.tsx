import React, { useState, useEffect, useCallback } from 'react';
import { TidalStation, TidalDataPoint, TidalStationConfig } from '../types';
import {
  Waves,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Calendar,
  Clock,
  ArrowUp,
  ArrowDown,
  Info,
  ExternalLink,
  MapPin,
} from 'lucide-react';

interface TideViewProps {
  config: TidalStationConfig;
}

export const TideView: React.FC<TideViewProps> = ({ config }) => {
  const [activeStationIdx, setActiveStationIdx] = useState(0);
  const [stationData, setStationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStation = config.stations[activeStationIdx];

  const fetchTideData = useCallback(async (stationId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/tides/data/${stationId}`);
      const data = await resp.json();
      if (data.success) {
        setStationData(data);
      } else {
        setError('Failed to load tidal data');
      }
    } catch (err) {
      setError('Network error loading tidal data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeStation) {
      fetchTideData(activeStation.id);
    }
  }, [activeStation, fetchTideData]);

  if (config.stations.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-slate-900/40 rounded-[2.5rem] border border-dashed border-slate-800 text-center">
        <div className="w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 mb-6 shadow-inner">
          <Waves className="w-10 h-10 text-slate-800" />
        </div>
        <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm">No Tidal Stations Configured</h3>
        <p className="text-slate-600 text-[10px] mt-2 max-w-[240px] uppercase font-bold tracking-widest leading-relaxed">
          Go to the Notifications tab to add your favorite Nova Scotia tidal stations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Station Tabs */}
      <div className="flex flex-wrap gap-2 pb-2">
        {config.stations.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => setActiveStationIdx(idx)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeStationIdx === idx
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {s.name}
          </button>
        ))}
        <button
          onClick={() => {}} // This should ideally link to settings
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white"
          title="Configure Stations"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scanning Oceanic Telemetry...</p>
        </div>
      ) : error ? (
        <div className="p-10 text-center bg-red-950/20 border border-red-500/20 rounded-3xl">
          <Info className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-sm font-bold text-red-400 uppercase">{error}</p>
        </div>
      ) : stationData ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Chart Section */}
          <div className="xl:col-span-2 space-y-6">
            <TideChart station={activeStation} data={stationData.predictions} highLow={stationData.highLow} />

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Upcoming High & Low Tides</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stationData.highLow.map((item: any, idx: number) => {
                  const isHigh = item.value > 1.0; // Basic heuristic
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isHigh ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {isHigh ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-500">{isHigh ? 'High Tide' : 'Low Tide'}</p>
                          <p className="text-sm font-black text-white">{new Date(item.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-white">{item.value.toFixed(2)}m</p>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{new Date(item.eventDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metadata Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-400">
                  <Info className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Station Intelligence</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Station Name</span>
                  <p className="text-base font-black text-white uppercase italic">{activeStation.name}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">DFO Code</span>
                  <p className="text-sm font-mono font-bold text-cyan-400">{activeStation.code}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Location</span>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-xs font-bold text-slate-400">{activeStation.province || 'Nova Scotia'}, Canada</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <a
                    href={`https://www.tides.gc.ca/en/stations/${activeStation.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-xs font-black uppercase tracking-widest"
                  >
                    <span>View Official CHS Data</span>
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

const TideChart: React.FC<{ station: TidalStation; data: TidalDataPoint[]; highLow: any[] }> = ({ station, data, highLow }) => {
  if (data.length < 2) return null;

  const width = 800;
  const height = 200;
  const padding = 20;

  const minVal = Math.min(...data.map(d => d.value));
  const maxVal = Math.max(...data.map(d => d.value));
  const range = maxVal - minVal;

  const minTime = new Date(data[0].eventDate).getTime();
  const maxTime = new Date(data[data.length - 1].eventDate).getTime();
  const timeRange = maxTime - minTime;

  const getX = (dateStr: string) => ((new Date(dateStr).getTime() - minTime) / timeRange) * (width - 2 * padding) + padding;
  const getY = (val: number) => height - (((val - minVal) / range) * (height - 2 * padding) + padding);

  let pathData = `M ${getX(data[0].eventDate)} ${getY(data[0].value)}`;
  for (let i = 1; i < data.length; i++) {
    pathData += ` L ${getX(data[i].eventDate)} ${getY(data[i].value)}`;
  }

  // Find current time point
  const now = new Date();
  const currentX = getX(now.toISOString());

  // Linear interpolation for current value
  let currentVal = data[0].value;
  for (let i = 0; i < data.length - 1; i++) {
    const t1 = new Date(data[i].eventDate).getTime();
    const t2 = new Date(data[i+1].eventDate).getTime();
    if (now.getTime() >= t1 && now.getTime() <= t2) {
      const ratio = (now.getTime() - t1) / (t2 - t1);
      currentVal = data[i].value + (data[i+1].value - data[i].value) * ratio;
      break;
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Predicted Tidal Curve (24h)</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{currentVal.toFixed(2)}</span>
            <span className="text-xs font-bold text-slate-500">meters</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
             <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest">Active Level</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400">{now.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="relative h-48 bg-slate-950 rounded-3xl border border-slate-800/50 p-2 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d">
          {/* Grid lines */}
          <line x1={padding} y1={getY(minVal)} x2={width-padding} y2={getY(minVal)} stroke="#1e293b" strokeDasharray="4 4" />
          <line x1={padding} y1={getY(maxVal)} x2={width-padding} y2={getY(maxVal)} stroke="#1e293b" strokeDasharray="4 4" />

          {/* Area fill */}
          <path
            d={`${pathData} L ${getX(data[data.length - 1].eventDate)} ${height} L ${getX(data[0].eventDate)} ${height} Z`}
            fill="url(#tideGradient)"
            opacity="0.3"
          />

          {/* Main Curve */}
          <path d={pathData} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />

          {/* Current Marker */}
          {currentX >= padding && currentX <= width - padding && (
            <g>
              <line x1={currentX} y1={0} x2={currentX} y2={height} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <circle cx={currentX} cy={getY(currentVal)} r="5" fill="#fff" className="animate-pulse" />
              <circle cx={currentX} cy={getY(currentVal)} r="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            </g>
          )}

          {/* High/Low Markers */}
          {highLow.map((hl, idx) => (
             <g key={idx}>
                <circle cx={getX(hl.eventDate)} cy={getY(hl.value)} r="3" fill="#64748b" />
             </g>
          ))}

          <defs>
            <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* X-Axis labels */}
        <div className="absolute bottom-1 left-0 right-0 px-5 flex justify-between text-[8px] font-mono font-bold text-slate-600 uppercase">
          <span>-6h</span>
          <span>Now</span>
          <span>+6h</span>
          <span>+12h</span>
          <span>+18h</span>
        </div>
      </div>
    </div>
  );
};
