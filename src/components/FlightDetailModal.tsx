import React, { useEffect, useState } from 'react';
import { X, Plane, Gauge, ArrowUp, Radio, Compass, ExternalLink, ImageOff } from 'lucide-react';
import { AircraftPosition, FlightDetail } from '../types';

interface FlightDetailModalProps {
  aircraft: AircraftPosition | null;
  onClose: () => void;
}

export const FlightDetailModal: React.FC<FlightDetailModalProps> = ({ aircraft, onClose }) => {
  const [detail, setDetail] = useState<FlightDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!aircraft) return;
    setDetail(null);
    setIsLoading(true);
    const params = new URLSearchParams({ hex: aircraft.hex });
    if (aircraft.flight) params.set('callsign', aircraft.flight);
    fetch(`/api/flights/detail?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .catch(() => setDetail({ success: false, error: 'Lookup failed' }))
      .finally(() => setIsLoading(false));
  }, [aircraft?.hex, aircraft?.flight]);

  if (!aircraft) return null;

  const label = aircraft.flight || aircraft.hex.toUpperCase();

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <Plane className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
                Live Aircraft Detail
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">{label}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Photo */}
          <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
            {isLoading ? (
              <div className="text-slate-500 text-xs font-mono uppercase tracking-wider">Looking up aircraft...</div>
            ) : detail?.photo?.url ? (
              <>
                <img src={detail.photo.url} alt={label} className="w-full h-full object-contain" />
                {(detail.photo.photographer || detail.photo.link) && (
                  <a
                    href={detail.photo.link}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-2 right-2 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-slate-300 hover:text-white border border-slate-800"
                  >
                    <span>Photo: {detail.photo.photographer || 'planespotters.net'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <ImageOff className="w-10 h-10" />
                <span className="text-[10px] font-mono uppercase tracking-wider">No photo available</span>
              </div>
            )}
          </div>

          {/* Live telemetry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-slate-800">
            <Stat icon={<ArrowUp className="w-3.5 h-3.5" />} label="Altitude" value={aircraft.onGround ? 'Ground' : aircraft.altitude != null ? `${aircraft.altitude.toLocaleString()} ft` : '—'} />
            <Stat icon={<Gauge className="w-3.5 h-3.5" />} label="Speed" value={aircraft.groundSpeed != null ? `${Math.round(aircraft.groundSpeed)} kt` : '—'} />
            <Stat icon={<Compass className="w-3.5 h-3.5" />} label="Heading" value={aircraft.track != null ? `${Math.round(aircraft.track)}°` : '—'} />
            <Stat icon={<Radio className="w-3.5 h-3.5" />} label="Squawk" value={aircraft.squawk || '—'} />
          </div>

          {/* Aircraft & route info */}
          <div className="p-5 space-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider block text-slate-500 font-bold mb-1.5">Aircraft</span>
              {detail?.aircraft ? (
                <div className="text-sm text-white font-bold">
                  {detail.aircraft.manufacturer} {detail.aircraft.type}
                  {detail.aircraft.registration && (
                    <span className="ml-2 text-slate-400 font-mono text-xs">({detail.aircraft.registration})</span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-500">{isLoading ? 'Looking up...' : 'Unknown aircraft type'}</span>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-wider block text-slate-500 font-bold mb-1.5">Route</span>
              {detail?.route ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white font-bold">{detail.route.originIata || detail.route.originName || '?'}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-white font-bold">{detail.route.destinationIata || detail.route.destinationName || '?'}</span>
                    {detail.route.airline && <span className="text-slate-400 text-xs ml-2">({detail.route.airline})</span>}
                  </div>
                  {(detail.route.departureTime || detail.route.arrivalTime) && (
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                      {detail.route.departureTime && (
                        <span>Departed: {new Date(detail.route.departureTime).toLocaleString()}</span>
                      )}
                      {detail.route.arrivalTime && (
                        <span>Last seen: {new Date(detail.route.arrivalTime).toLocaleString()}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  {isLoading ? 'Looking up...' : 'No route found for this flight number'}
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500 font-mono pt-2 border-t border-slate-800">
              ICAO24: {aircraft.hex.toUpperCase()} • {aircraft.distanceNm.toFixed(1)}nm from home
            </div>
          </div>
        </div>
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
