import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Camera,
  Layers,
  Sparkles,
  Volume2,
  VolumeX,
  Repeat,
  FastForward,
  Clock,
  Shield,
  Maximize2,
} from 'lucide-react';
import { FrigateEvent, CameraStream, ExclusionZone } from '../types';

const ZONE_COLORS = ['#ef4444', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899'];

interface TenSecondPlaybackModalProps {
  isOpen: boolean;
  event: FrigateEvent | null;
  camera?: CameraStream;
  onClose: () => void;
  onOpenSnapshot: (event: FrigateEvent) => void;
  /** This camera's configured exclusion zones, drawn over the playback
   *  window in place of the old per-event box — shows why a detection here
   *  would (or wouldn't) get filtered before an alert goes out. */
  exclusionZones?: ExclusionZone[];
}

export const TenSecondPlaybackModal: React.FC<TenSecondPlaybackModalProps> = ({
  isOpen,
  event,
  camera,
  onClose,
  onOpenSnapshot,
  exclusionZones,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0); // 0 to 10 seconds
  const [speed, setSpeed] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [videoError, setVideoError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Tracks which clipUrl is currently loaded into the <video>. Reading
  // video.src back from the DOM always returns the browser-resolved
  // ABSOLUTE URL, never the relative clipUrl string we set it to — comparing
  // against that directly is always unequal, causing video.load() to fire
  // (and restart the fetch from scratch) on every unrelated state change
  // (play/pause, speed change), which looks like the clip randomly stalling.
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
      setVideoError(false);
      loadedUrlRef.current = null;
      return;
    }
    setIsPlaying(true);
    setCurrentTime(0);
    setVideoError(false);
    loadedUrlRef.current = null;
  }, [isOpen, event]);

  // Video element sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoError) return;

    video.playbackRate = speed;

    // Only (re)load when the clip actually changes, not on every play/pause
    // or speed toggle.
    if (event?.clipUrl && loadedUrlRef.current !== event.clipUrl) {
      loadedUrlRef.current = event.clipUrl;
      video.load();
    }

    if (isPlaying) {
      video.play().catch(() => {
        // Handle auto-play block or other interaction errors
      });
    } else {
      video.pause();
    }
  }, [isPlaying, speed, videoError, event?.clipUrl]);

  // Simulated 10-second canvas playback loop if no real video or in simulation
  useEffect(() => {
    if (!isOpen || !event) return;

    // IF we have a working video, don't run the manual time increment loop
    // But still allow the canvas to render if no videoUrl or videoError
    const useSimulation = !event.clipUrl || videoError;

    let lastTimestamp = performance.now();

    const loop = (now: number) => {
      const deltaSec = ((now - lastTimestamp) / 1000) * speed;
      lastTimestamp = now;

      if (useSimulation && isPlaying) {
        setCurrentTime((prev) => {
          let next = prev + deltaSec;
          if (next >= 10) {
            if (isLooping) {
              return 0;
            } else {
              setIsPlaying(false);
              return 10;
            }
          }
          return next;
        });
      }

      // Render canvas scene if we're in simulation mode
      if (useSimulation) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawPlaybackScene(ctx, canvas.width, canvas.height, event, currentTime);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen, event, isPlaying, speed, isLooping, videoError, currentTime]);

  if (!isOpen || !event) return null;

  const handleTogglePlay = () => setIsPlaying(!isPlaying);
  const handleSeek = (newTime: number) => {
    setCurrentTime(Math.max(0, Math.min(10, newTime)));
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const formattedDate = new Date(event.startTime).toLocaleDateString();
  const formattedTime = new Date(event.startTime).toLocaleTimeString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
                10-Second Event Buffer Playback
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">
                {event.camera.toUpperCase().replace(/_/g, ' ')} — {event.label.toUpperCase()} DETECTED
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenSnapshot(event)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider border border-slate-800 transition-colors"
              title="Inspect still snapshot"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snapshot View</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video / Canvas Playback Window */}
        <div className="relative bg-black aspect-video max-h-[500px] flex items-center justify-center overflow-hidden select-none">
          {event.clipUrl && !videoError ? (
            <video
              ref={videoRef}
              src={event.clipUrl}
              className="w-full h-full object-contain"
              playsInline
              muted={isMuted}
              loop={isLooping}
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
              onError={() => {
                console.error('[Playback] Video source failed to load');
                setVideoError(true);
              }}
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={800}
              height={450}
              className="w-full h-full object-contain bg-[#0D0E10]"
            />
          )}

          {/* This camera's exclusion zones — overlaid on top of either the
              real clip or the simulated canvas, so you can see whether the
              detection is (or should be) inside a filtered area. */}
          {showZones && exclusionZones && exclusionZones.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
              {exclusionZones.map((zone, idx) => {
                if (zone.points.length < 3) return null;
                const color = ZONE_COLORS[idx % ZONE_COLORS.length];
                return (
                  <polygon
                    key={zone.id}
                    points={zone.points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                    fill={color}
                    fillOpacity={0.2}
                    stroke={color}
                    strokeWidth={0.6}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          )}

          {/* Video Error Message */}
          {videoError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm p-6 text-center">
              <Shield className="w-12 h-12 text-amber-500 mb-3 opacity-50" />
              <div className="text-white font-black uppercase tracking-widest text-sm mb-1">Stream Unavailable</div>
              <div className="text-slate-400 text-[10px] uppercase font-bold max-w-[240px]">
                Frigate Host is unreachable or clip is not ready. Showing AI simulation instead.
              </div>
            </div>
          )}

          {/* Real-time Bounding Box & HUD overlay */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-1 text-xs bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-black text-white uppercase">{event.camera}</span>
              <span className="text-slate-400 font-mono">
                T{currentTime <= 5 ? `-${(5 - currentTime).toFixed(1)}s` : `+${(currentTime - 5).toFixed(1)}s`}
              </span>
            </div>
            <div className="text-[10px] text-emerald-400 font-bold uppercase">
              {event.label} • Confidence: {Math.round(event.score * 100)}%
            </div>
          </div>

          {/* Trigger point indicator */}
          {Math.abs(currentTime - 5) < 0.4 && (
            <div className="absolute top-4 right-4 z-20 pointer-events-none bg-red-600 text-white font-mono text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider animate-pulse shadow-lg">
              ★ EVENT TRIGGER POINT (T0)
            </div>
          )}
        </div>

        {/* 10-Second Interactive Scrubber & Timeline Bar */}
        <div className="bg-slate-900/90 px-6 py-4 border-t border-slate-800 space-y-3">
          {/* Scrubber slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-white">
                Playhead: <span className="font-mono">{currentTime.toFixed(1)}s</span> / 10.0s
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Buffer: -5.0s (Pre-trigger) to +5.0s (Post-trigger)
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                type="range"
                min={0}
                max={10}
                step={0.05}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-white border border-slate-800"
              />
            </div>

            {/* Time Ticks */}
            <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-0.5">
              <span>-5s (Pre)</span>
              <span>-4s</span>
              <span>-3s</span>
              <span>-2s</span>
              <span>-1s</span>
              <span className="font-bold text-red-400">0s (Trigger)</span>
              <span>+1s</span>
              <span>+2s</span>
              <span>+3s</span>
              <span>+4s</span>
              <span>+5s (Post)</span>
            </div>
          </div>

          {/* Player Transport Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Left Transport buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSeek(0)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800"
                title="Restart from start (-5s)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleSeek(currentTime - 1)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800"
                title="Step backward 1s"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleTogglePlay}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors shadow-sm"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play</span>
                  </>
                )}
              </button>
              <button
                onClick={() => handleSeek(currentTime + 1)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800"
                title="Step forward 1s"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleSeek(5)}
                className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-[10px] uppercase tracking-wider font-bold ml-1"
                title="Jump directly to trigger frame"
              >
                Jump to Trigger (0s)
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-xl border transition-colors ${
                  isMuted
                    ? 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Right Speed & Options */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] uppercase font-bold border transition-colors ${
                  isLooping
                    ? 'bg-white text-slate-950 border-white font-black'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
                title="Loop 10s playback"
              >
                <Repeat className="w-3 h-3" />
                <span>Loop {isLooping ? 'ON' : 'OFF'}</span>
              </button>

              <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-0.5 text-[10px]">
                {[0.5, 1, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSpeed(spd)}
                    className={`px-2.5 py-1 rounded-lg font-mono uppercase font-bold ${
                      speed === spd
                        ? 'bg-white text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowZones(!showZones)}
                disabled={!exclusionZones || exclusionZones.length === 0}
                title={exclusionZones && exclusionZones.length > 0 ? undefined : 'No exclusion zones configured for this camera'}
                className={`px-3 py-1.5 rounded-xl text-[10px] uppercase font-bold border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  showZones
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Zones {showZones ? '✓' : '✗'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Details */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            <span>Recorded: <strong className="text-slate-200">{formattedDate} {formattedTime}</strong></span>
            {event.zones && event.zones.length > 0 && (
              <span className="ml-3 text-slate-400">
                • Zones: <strong className="text-white">{event.zones.join(', ') }</strong>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black uppercase tracking-wider text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Canvas drawing helper for simulated playback
function drawPlaybackScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  event: FrigateEvent,
  timeSec: number
) {
  ctx.clearRect(0, 0, width, height);

  // Background subtle gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#131417');
  bg.addColorStop(1, '#0b0c0e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Scenery perspective lines
  ctx.strokeStyle = '#23252a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.7);
  ctx.lineTo(width, height * 0.7);
  ctx.moveTo(width * 0.2, height * 0.7);
  ctx.lineTo(0, height);
  ctx.moveTo(width * 0.8, height * 0.7);
  ctx.lineTo(width, height);
  ctx.stroke();

  // Draw camera watermarks
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px monospace';
  ctx.fillText(`FRIGATE PLAYBACK • ${event.camera.toUpperCase()}`, 20, 25);
  ctx.fillText(`FPS: 25.0 • CODEC: H.264`, width - 180, 25);

  // Trajectory interpolation across 10 seconds:
  // Starts at t=0, moves across frame, triggers at t=5, exits or stabilizes at t=10
  const progress = timeSec / 10;
  const startX = (event.box?.x ?? 0.3) - 0.2;
  const endX = (event.box?.x ?? 0.3) + 0.2;
  const currentX = startX + (endX - startX) * progress;

  const startY = (event.box?.y ?? 0.3) + 0.05 * Math.sin(progress * Math.PI);
  const currentY = startY;

  const boxW = (event.box?.width ?? 0.25) * width;
  const boxH = (event.box?.height ?? 0.45) * height;
  const pixelX = currentX * width;
  const pixelY = currentY * height;

  // Draw visual object silhouette
  ctx.save();
  ctx.fillStyle = event.label === 'person' ? '#38bdf8' : '#eab308';
  ctx.globalAlpha = 0.85;

  if (event.label === 'person') {
    // Head
    ctx.beginPath();
    ctx.arc(pixelX + boxW / 2, pixelY + boxH * 0.2, boxH * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Torso
    ctx.fillRect(pixelX + boxW * 0.3, pixelY + boxH * 0.35, boxW * 0.4, boxH * 0.4);
    // Legs
    ctx.fillRect(pixelX + boxW * 0.32, pixelY + boxH * 0.75, boxW * 0.15, boxH * 0.25);
    ctx.fillRect(pixelX + boxW * 0.53, pixelY + boxH * 0.75, boxW * 0.15, boxH * 0.25);
  } else if (event.label === 'car') {
    // Car body
    ctx.fillRect(pixelX, pixelY + boxH * 0.4, boxW, boxH * 0.5);
    ctx.fillRect(pixelX + boxW * 0.2, pixelY + boxH * 0.15, boxW * 0.6, boxH * 0.3);
    // Wheels
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(pixelX + boxW * 0.25, pixelY + boxH * 0.9, boxH * 0.12, 0, Math.PI * 2);
    ctx.arc(pixelX + boxW * 0.75, pixelY + boxH * 0.9, boxH * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Generic object box
    ctx.fillRect(pixelX + boxW * 0.2, pixelY + boxH * 0.2, boxW * 0.6, boxH * 0.6);
  }
  ctx.restore();
}
