import React, { useEffect, useRef, useState } from 'react';
import { Plane, Settings, RefreshCw, ArrowUp } from 'lucide-react';
import { AircraftPosition, FlightsConfig } from '../types';
import { FlightMap } from './FlightMap';
import { FlightDetailModal } from './FlightDetailModal';

interface FlightsViewProps {
  config?: FlightsConfig;
  onGoToSettings: () => void;
}

const POLL_INTERVAL_MS = 4000;

export const FlightsView: React.FC<FlightsViewProps> = ({ config, onGoToSettings }) => {
  const [aircraft, setAircraft] = useState<AircraftPosition[]>([]);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConfigured = Boolean(config?.enabled && config?.piawareUrl);

  useEffect(() => {
    if (!isConfigured) return;

    const fetchAircraft = async () => {
      try {
        const resp = await fetch('/api/flights/aircraft');
        const data = await resp.json();
        if (data.success) {
          setAircraft(data.aircraft);
          setError(null);
          setLastUpdated(Date.now());
        } else {
          setError(data.error || 'Failed to fetch aircraft');
        }
      } catch {
        setError('Network error reaching the server');
      }
    };

    fetchAircraft();
    pollRef.current = setInterval(fetchAircraft, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isConfigured]);

  if (!isConfigured) {
    return (
      <div className="py-24 flex flex-col items-center justify-center bg-slate-900/40 rounded-[2.5rem] border border-dashed border-slate-800 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 mb-6 shadow-inner">
          <Plane className="w-10 h-10 text-slate-700" />
        </div>
        <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm">Flight Tracking Not Configured</h3>
        <p className="text-slate-600 text-[10px] mt-2 max-w-[280px] uppercase font-bold tracking-widest leading-relaxed">
          Connect a PiAware / dump1090-fa ADS-B receiver and set your home coordinates to see live air traffic.
        </p>
        <button
          onClick={onGoToSettings}
          className="mt-6 flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-widest transition-all"
        >
          <Settings className="w-4 h-4" />
          <span>Configure Receiver</span>
        </button>
      </div>
    );
  }

  const selectedAircraft = aircraft.find((a) => a.hex === selectedHex) || null;
  const sorted = [...aircraft].sort((a, b) => a.distanceNm - b.distanceNm);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Plane className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black uppercase tracking-tight text-white">Live Air Traffic</h2>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-300">
            {aircraft.length} in range
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-[10px] uppercase font-bold text-red-400">{error}</span>}
          {lastUpdated && !error && (
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" />
              Updated {Math.round((Date.now() - lastUpdated) / 1000)}s ago
            </span>
          )}
          <button
            onClick={onGoToSettings}
            title="Flight tracking settings"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <FlightMap
        aircraft={aircraft}
        homeLat={config!.homeLat}
        homeLon={config!.homeLon}
        selectedHex={selectedHex}
        onSelectAircraft={setSelectedHex}
      />

      {/* Flight table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="text-left px-4 py-3">Flight</th>
                <th className="text-right px-4 py-3">Altitude</th>
                <th className="text-right px-4 py-3">Speed</th>
                <th className="text-right px-4 py-3">Heading</th>
                <th className="text-right px-4 py-3">Squawk</th>
                <th className="text-right px-4 py-3">Distance</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-600 font-mono text-[11px]">
                    No aircraft currently in range.
                  </td>
                </tr>
              ) : (
                sorted.map((a) => (
                  <tr
                    key={a.hex}
                    onClick={() => setSelectedHex(a.hex)}
                    className={`border-b border-slate-900 cursor-pointer transition-colors hover:bg-slate-900/60 ${
                      a.hex === selectedHex ? 'bg-amber-950/30' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 font-black text-white">
                      <div className="flex items-center gap-2">
                        <Plane
                          className="w-3 h-3 text-amber-400 shrink-0"
                          style={{ transform: `rotate(${(a.track ?? 0) - 45}deg)` }}
                        />
                        {a.flight || a.hex.toUpperCase()}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                      {a.onGround ? (
                        <span className="text-slate-500">Ground</span>
                      ) : a.altitude != null ? (
                        `${a.altitude.toLocaleString()} ft`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                      {a.groundSpeed != null ? `${Math.round(a.groundSpeed)} kt` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                      {a.track != null ? `${Math.round(a.track)}°` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">{a.squawk || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white font-bold">{a.distanceNm.toFixed(1)}nm</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAircraft && (
        <FlightDetailModal aircraft={selectedAircraft} onClose={() => setSelectedHex(null)} />
      )}
    </div>
  );
};
