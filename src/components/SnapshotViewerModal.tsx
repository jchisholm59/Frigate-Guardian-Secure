import React, { useState } from 'react';
import {
  X,
  Camera,
  ZoomIn,
  ZoomOut,
  Download,
  Play,
  Maximize2,
  CheckCircle2,
  Layers,
  Sparkles,
  Shield,
  Eye,
} from 'lucide-react';
import { FrigateEvent, CameraStream } from '../types';

interface SnapshotViewerModalProps {
  isOpen: boolean;
  event: FrigateEvent | null;
  camera?: CameraStream;
  onClose: () => void;
  onOpenPlayback: (event: FrigateEvent) => void;
}

export const SnapshotViewerModal: React.FC<SnapshotViewerModalProps> = ({
  isOpen,
  event,
  camera,
  onClose,
  onOpenPlayback,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  if (!isOpen || !event) return null;

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3, z + 0.5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(1, z - 0.5));

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      const link = document.createElement('a');
      link.download = `frigate-snapshot-${event.camera}-${event.id}.jpg`;
      link.href = event.snapshotUrl || '';
      link.target = '_blank';
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const formattedDate = new Date(event.startTime).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = new Date(event.startTime).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-slate-300" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
                High-Resolution Detection Snapshot
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">
                {event.camera.toUpperCase().replace(/_/g, ' ')} — {event.label.toUpperCase()}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPlayback(event)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs uppercase tracking-wider font-black transition-all shadow-sm"
              title="Open 10s video playback"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>10s Playback</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Snapshot View Canvas Area */}
        <div className="relative bg-black flex-1 min-h-[380px] max-h-[560px] overflow-hidden flex items-center justify-center select-none group">
          {event.snapshotUrl ? (
            <div
              className="relative transition-transform duration-200 ease-out origin-center"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={event.snapshotUrl}
                alt={`Snapshot of ${event.label} on ${event.camera}`}
                className="max-h-[520px] w-auto object-contain block mx-auto"
                onError={(e) => {
                  // Fallback if direct frigate proxy fails
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              {/* Optional overlay bounding box if not baked in image */}
              {showBoundingBox && event.box && (
                <div
                  className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none transition-all"
                  style={{
                    left: `${event.box.x * 100}%`,
                    top: `${event.box.y * 100}%`,
                    width: `${event.box.width * 100}%`,
                    height: `${event.box.height * 100}%`,
                  }}
                >
                  <span className="absolute -top-5 left-0 bg-red-600 text-white font-mono text-[9px] uppercase px-1 py-0.2 font-bold whitespace-nowrap">
                    {event.label} ({Math.round(event.score * 100)}%)
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* High-fidelity SVG / simulated canvas representation */
            <div
              className="relative w-full h-full min-h-[400px] flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {/* Simulated camera background frame */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

              <div className="text-center space-y-3 z-10">
                <div className="w-20 h-20 mx-auto rounded-2xl border border-slate-800 bg-slate-900 flex items-center justify-center">
                  <Camera className="w-10 h-10 text-slate-400" />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-tight text-2xl text-white">
                    {event.camera.replace(/_/g, ' ')}
                  </h4>
                  <p className="text-xs font-mono text-slate-400 mt-1">
                    Frame capture resolution: 2560x1440 • {formattedDate} {formattedTime}
                  </p>
                </div>
              </div>

              {/* Simulated bounding box */}
              {showBoundingBox && (
                <div
                  className="absolute border-2 border-emerald-400 bg-emerald-400/10 rounded-lg"
                  style={{
                    left: `${(event.box?.x ?? 0.35) * 100}%`,
                    top: `${(event.box?.y ?? 0.25) * 100}%`,
                    width: `${(event.box?.width ?? 0.3) * 100}%`,
                    height: `${(event.box?.height ?? 0.5) * 100}%`,
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                    {event.label} • {Math.round(event.score * 100)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Snapshot Controls Overlay */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-mono font-bold text-slate-200 min-w-[3rem] text-center">
              {(zoomLevel * 100).toFixed(0)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button
              onClick={() => setShowBoundingBox(!showBoundingBox)}
              className={`px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-colors ${
                showBoundingBox
                  ? 'bg-white text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Box {showBoundingBox ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Snapshot Timestamp HUD */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-200">
            <div>
              <span className="text-white font-black tracking-wider uppercase">{event.camera}</span>{' '}
              <span className="text-slate-400 font-mono">[{formattedTime}]</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Target: <span className="text-emerald-400 font-bold uppercase">{event.label}</span> (
              {Math.round(event.score * 100)}% confidence)
            </div>
          </div>
        </div>

        {/* Metadata & Actions Footer */}
        <div className="p-5 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <div>
              <span className="text-[10px] uppercase tracking-wider block text-slate-500 font-bold">
                Zones Triggered
              </span>
              <span className="text-white font-bold">
                {event.zones && event.zones.length > 0 ? event.zones.join(', ') : 'None / Whole Frame'}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-wider block text-slate-500 font-bold">
                Event Duration
              </span>
              <span className="text-white font-bold">{event.duration}s event window</span>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-wider block text-slate-500 font-bold">
                Event ID
              </span>
              <span className="text-slate-300 font-mono text-[11px]">{event.id}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {event.snapshotUrl && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Snapshot</span>
              </button>
            )}

            <button
              onClick={() => onOpenPlayback(event)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 uppercase tracking-wider text-xs font-black transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch 10s Playback</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
