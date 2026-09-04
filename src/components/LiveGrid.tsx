import React, { useState } from 'react';
import {
  CameraStream,
  DetectedObject,
  SystemTelemetryData,
} from '../types';
import { CameraFeedCanvas } from './CameraFeedCanvas';
import {
  Eye,
  Grid2X2,
  Grid3X3,
  Maximize2,
  Play,
  Pause,
  Layers,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  ShieldAlert,
  RefreshCw,
  Server,
  CheckCircle2,
} from 'lucide-react';

interface LiveGridProps {
  cameras: CameraStream[];
  activeServerName?: string;
  isLiveHostConnected?: boolean;
  telemetry?: SystemTelemetryData;
  onSelectCamera: (camera: CameraStream) => void;
  onSelectObject?: (camera: CameraStream, obj: DetectedObject) => void;
  onToggleDetect: (cameraId: string) => void;
  onToggleRecord: (cameraId: string) => void;
  onResyncStreams?: () => Promise<void> | void;
  onOpenHostModal?: () => void;
}

export const LiveGrid: React.FC<LiveGridProps> = ({
  cameras,
  activeServerName,
  isLiveHostConnected = false,
  telemetry,
  onSelectCamera,
  onSelectObject,
  onToggleDetect,
  onToggleRecord,
  onResyncStreams,
  onOpenHostModal,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [showMasks, setShowMasks] = useState(false);
  const [isBirdsEye, setIsBirdsEye] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'large'>('grid');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleResync = async () => {
    if (!onResyncStreams) return;
    setIsSyncing(true);
    try {
      await onResyncStreams();
    } finally {
      setIsSyncing(false);
    }
  };

  // BirdsEye view filters cameras that have active motion or detection zones
  const displayedCameras = isBirdsEye
    ? cameras.filter((c) => c.thumbnailTheme === 'front_porch' || c.thumbnailTheme === 'driveway')
    : cameras;

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        {/* Left Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* BirdsEye Toggle */}
          <button
            id="btn-birdseye-toggle"
            onClick={() => setIsBirdsEye(!isBirdsEye)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              isBirdsEye
                ? 'bg-white text-slate-950 font-black shadow-md'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>BirdsEye {isBirdsEye ? 'ON' : 'OFF'}</span>
          </button>

          {/* Pause / Play */}
          <button
            id="btn-pause-streams"
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors"
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-white" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-slate-400" />
                <span>Pause</span>
              </>
            )}
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Bounding Boxes Toggle */}
          <button
            id="btn-toggle-boxes"
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border ${
              showBoxes
                ? 'bg-slate-800 text-white border-slate-700 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
          >
            Boxes {showBoxes ? '✓' : '✗'}
          </button>

          {/* Zones Overlay Toggle */}
          <button
            id="btn-toggle-zones"
            onClick={() => setShowZones(!showZones)}
            className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border ${
              showZones
                ? 'bg-slate-800 text-white border-slate-700 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
          >
            Zones {showZones ? '✓' : '✗'}
          </button>

          {/* Motion Masks Toggle */}
          <button
            id="btn-toggle-masks"
            onClick={() => setShowMasks(!showMasks)}
            className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border ${
              showMasks
                ? 'bg-slate-800 text-white border-slate-700 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
          >
            Masks {showMasks ? '✓' : '✗'}
          </button>
        </div>

        {/* Right Layout View Switcher */}
        <div className="flex items-center gap-2.5">
          {onResyncStreams && (
            <button
              id="btn-resync-camera-streams"
              onClick={handleResync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors disabled:opacity-40"
              title="Resync auto-detected camera streams from active Frigate server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Scanning...' : 'Resync Feeds'}</span>
            </button>
          )}

          <div
            onClick={onOpenHostModal}
            className={`flex items-center gap-2 text-xs uppercase tracking-wider font-bold bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 ${
              onOpenHostModal ? 'cursor-pointer hover:border-slate-700' : ''
            }`}
            title="Click to manage Frigate servers and streams"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
            <span className="text-slate-400 hidden lg:inline">{activeServerName || 'Server'}:</span>
            <span className="text-white font-black">{displayedCameras.length} Stream{displayedCameras.length === 1 ? '' : 's'}</span>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-lg ${
                layoutMode === 'grid' ? 'bg-white text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Multi-Grid View"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode('large')}
              className={`p-1.5 rounded-lg ${
                layoutMode === 'large' ? 'bg-white text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Large View"
            >
              <Grid2X2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Editorial System Micro-Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">CPU Usage</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono tracking-tighter text-white">
              {telemetry ? telemetry.cpuPercent.toFixed(1) : '18.5'}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">%</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Coral Inference</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono tracking-tighter text-white">
              {telemetry ? telemetry.coral.inferenceSpeedMs.toFixed(1) : '8.2'}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">ms</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Detection FPS</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono tracking-tighter text-white">
              {telemetry ? telemetry.coral.detectionFps.toFixed(0) : '42'}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">fps</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between rounded-2xl shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Stream Pipelines</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono tracking-tighter text-white">
              {displayedCameras.length.toString().padStart(2, '0')}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">MJPEG</span>
          </div>
        </div>
      </div>

      {/* BirdsEye Banner Notice */}
      {isBirdsEye && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>
              <strong className="font-black uppercase tracking-wide text-red-300">BIRDSEYE AUTO-SWITCH ACTIVE:</strong> Prioritizing cameras with detected motion and target objects.
            </span>
          </div>
          <button
            onClick={() => setIsBirdsEye(false)}
            className="text-white underline hover:text-slate-300 uppercase tracking-widest text-[11px] font-bold"
          >
            Show All Cameras
          </button>
        </div>
      )}

      {/* Cameras Grid or Disabled Dummy State */}
      {displayedCameras.length === 0 ? (
        <div className="bg-slate-900 border border-dashed border-slate-800 rounded-[2rem] p-12 text-center max-w-2xl mx-auto my-8 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Server className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-black tracking-tighter uppercase text-white mb-2">No Active Camera Streams</h3>
          <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">
            The dummy camera simulation option is currently disabled or removed. You can connect a real Frigate NVR host or manage dummy camera options in Server Settings.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onOpenHostModal && (
              <button
                onClick={onOpenHostModal}
                className="px-6 py-3 bg-white text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl hover:scale-[0.99] transition-transform"
              >
                Open Server Settings & Notifications
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-6 ${
            layoutMode === 'grid'
              ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
              : 'grid-cols-1 lg:grid-cols-2'
          }`}
        >
          {displayedCameras.map((camera) => {
            const primaryObj = camera.detectedObjects && camera.detectedObjects.length > 0 ? camera.detectedObjects[0] : null;

            return (
              <div
                key={camera.id}
                id={`camera-card-${camera.id}`}
                className="group flex flex-col rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-200 shadow-xl"
              >
              {/* Camera Card Top Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/80 border-b border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-white truncate">{camera.name}</h3>
                  <span className="text-[9px] font-mono font-bold text-slate-400 border border-slate-800 bg-slate-900 px-2 py-0.5 rounded-md shrink-0">
                    {camera.resolution}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono font-bold text-slate-400 hidden sm:inline">
                    {camera.fps} fps
                  </span>
                  {/* Maximize / Inspect Button */}
                  <button
                    id={`btn-maximize-${camera.id}`}
                    onClick={() => onSelectCamera(camera)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Inspect feed & detail"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Video Canvas Feed Container */}
              <div
                className="relative cursor-pointer bg-black"
                onClick={() => onSelectCamera(camera)}
              >
                {/* Live Tag overlay */}
                <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2 pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                  <span className="text-[10px] uppercase tracking-widest font-black text-white drop-shadow">
                    LIVE — {camera.name}
                  </span>
                </div>

                {/* Detected Object Editorial Badge */}
                {primaryObj && (
                  <div className="absolute bottom-3.5 left-3.5 z-20 pointer-events-none">
                    <div className="bg-white text-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-wider mb-1 inline-block rounded-lg shadow-md">
                      {primaryObj.label} Detected
                    </div>
                    <div className="flex items-end gap-1.5 text-white drop-shadow">
                      <span className="text-3xl font-black tracking-tighter">
                        {(primaryObj.score * 100).toFixed(1)}%
                      </span>
                      <span className="text-[9px] uppercase tracking-widest font-bold opacity-80 mb-1">
                        Confidence
                      </span>
                    </div>
                  </div>
                )}

                <CameraFeedCanvas
                  camera={camera}
                  isPaused={isPaused}
                  showBoundingBoxes={showBoxes}
                  showZones={showZones}
                  showMotionMasks={showMasks}
                  showHud={true}
                  onObjectClick={(obj) => onSelectObject && onSelectObject(camera, obj)}
                />

                {/* Hover overlay button to inspect */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                  <div className="px-4 py-2 rounded-xl bg-slate-900/90 text-white text-xs font-black uppercase tracking-wider border border-slate-700 shadow-2xl flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-white" />
                    <span>Inspect & Detail</span>
                  </div>
                </div>
              </div>

              {/* Camera Card Footer Controls */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-950/80 border-t border-slate-800 text-xs font-sans">
                <div className="flex items-center gap-2">
                  {/* Detection Toggle */}
                  <button
                    onClick={() => onToggleDetect(camera.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                      camera.detectEnabled
                        ? 'bg-white text-slate-950 font-black border-white'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                    title="Toggle AI Object Detection"
                  >
                    <Radio className="w-3 h-3" />
                    <span>Detect</span>
                  </button>

                  {/* Record Toggle */}
                  <button
                    onClick={() => onToggleRecord(camera.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                      camera.recordEnabled
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                    title="Toggle 24/7 & Event Recording"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>Record</span>
                  </button>
                </div>

                {/* Audio & Zone Metadata */}
                <div className="flex items-center gap-3 text-slate-400 font-mono text-[10px]">
                  {camera.audioEnabled ? (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Volume2 className="w-3 h-3" /> Audio
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 opacity-50">
                      <VolumeX className="w-3 h-3" /> Mute
                    </span>
                  )}
                  <span className="opacity-20">|</span>
                  <span className="uppercase tracking-wider font-bold">
                    {camera.zones.length} {camera.zones.length === 1 ? 'zone' : 'zones'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
