import React, { useState } from 'react';
import { CameraStream, DetectedObject } from '../types';
import { CameraFeedCanvas } from './CameraFeedCanvas';
import {
  X,
  Camera,
  Copy,
  Check,
  CheckCircle2,
} from 'lucide-react';

interface CameraDetailModalProps {
  camera: CameraStream;
  onClose: () => void;
  onSwitchStreamType: (cameraId: string, type: 'main' | 'sub') => void;
}

export const CameraDetailModal: React.FC<CameraDetailModalProps> = ({
  camera,
  onClose,
  onSwitchStreamType,
}) => {
  const [showZones, setShowZones] = useState(true);
  const [showMasks, setShowMasks] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);
  const [copiedRtsp, setCopiedRtsp] = useState(false);

  const handleCopyRtsp = () => {
    if (camera.rtspUrl) {
      navigator.clipboard.writeText(camera.rtspUrl);
      setCopiedRtsp(true);
      setTimeout(() => setCopiedRtsp(false), 2000);
    }
  };

  const handleCaptureSnapshot = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Attempt real snapshot download
    if (camera.frigate_url) {
      const snapshotUrl = `/api/frigate/proxy/image?serverUrl=${encodeURIComponent(camera.frigate_url)}&path=${encodeURIComponent(`/api/${camera.id}/latest.jpg`)}`;

      try {
        const response = await fetch(snapshotUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `snapshot-${camera.id}-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setSnapshotSuccess(true);
        setTimeout(() => setSnapshotSuccess(false), 3000);
      } catch (err) {
        console.error('Failed to download snapshot:', err);
      }
    } else {
      // Fallback for simulated cameras
      setSnapshotSuccess(true);
      setTimeout(() => setSnapshotSuccess(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
                Live Intercept
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white">
                {camera.name}
              </h2>
              <p className="text-xs text-slate-400 font-medium pt-0.5">
                {camera.location} • {camera.resolution} @ {camera.fps} FPS •{' '}
                {(camera.bitrateKbps / 1000).toFixed(1)} Mb/s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stream resolution toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => onSwitchStreamType(camera.id, 'main')}
                className={`px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-all ${
                  camera.streamType === 'main'
                    ? 'bg-white text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white font-bold'
                }`}
              >
                Main (HQ)
              </button>
              <button
                onClick={() => onSwitchStreamType(camera.id, 'sub')}
                className={`px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-all ${
                  camera.streamType === 'sub'
                    ? 'bg-white text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white font-bold'
                }`}
              >
                Sub (Low-Res)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stream Source Info & Port Architecture Bar */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Feed: Continuous MJPEG (15-25 FPS via Port 5000)
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400 font-medium">
              Telemetry & Coral TPU: Connected
            </span>
          </div>

          {camera.rtspUrl && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">RTSP Port 8554:</span>
              <code className="bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800 text-slate-300 text-[11px] font-mono">
                {camera.rtspUrl}
              </code>
              <button
                onClick={handleCopyRtsp}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold transition-colors"
                title="Copy RTSP URL for VLC / OBS"
              >
                {copiedRtsp ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Video Canvas Container */}
        <div className="relative bg-black flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="w-full h-full max-w-full max-h-full flex items-center justify-center pointer-events-none">
            <CameraFeedCanvas
              camera={camera}
              zoom={1}
              panX={0}
              panY={0}
              showBoundingBoxes={showBoxes}
              showZones={showZones}
              showMotionMasks={showMasks}
              showHud={true}
              className="w-auto h-auto max-w-full max-h-full aspect-video shadow-2xl rounded-lg border border-slate-800 bg-zinc-900 pointer-events-auto"
            />
          </div>

          {/* Snapshot notification toast */}
          {snapshotSuccess && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Snapshot stored in archive</span>
            </div>
          )}
        </div>

        {/* Footer info & toggle bar */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBoxes(!showBoxes)}
              className={`px-3 py-1.5 rounded-xl border text-[10px] uppercase tracking-wider font-bold transition-colors ${
                showBoxes
                  ? 'bg-white text-slate-950 border-white font-black'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              Bounding Boxes {showBoxes ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowZones(!showZones)}
              className={`px-3 py-1.5 rounded-xl border text-[10px] uppercase tracking-wider font-bold transition-colors ${
                showZones
                  ? 'bg-white text-slate-950 border-white font-black'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              Zones {showZones ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowMasks(!showMasks)}
              className={`px-3 py-1.5 rounded-xl border text-[10px] uppercase tracking-wider font-bold transition-colors ${
                showMasks
                  ? 'bg-white text-slate-950 border-white font-black'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              Masks {showMasks ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-take-snapshot"
              onClick={handleCaptureSnapshot}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture Snapshot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
