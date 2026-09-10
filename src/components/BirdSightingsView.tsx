import React, { useState, useEffect, useRef } from 'react';
import { BirdSighting, BirdNetConfig } from '../types';
import {
  Bird,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Calendar,
  Clock,
  Shield,
  Filter,
  BarChart3,
  X,
  Volume2,
  Activity,
  AudioWaveform,
  Zap,
  PieChart,
  Play,
  FileText,
  Music,
} from 'lucide-react';

// Shared Audio Context for Spectrogram to avoid "Multiple Source" browser errors
let sharedAudioCtx: AudioContext | null = null;
let sharedAnalyzer: AnalyserNode | null = null;

const LiveAudioMonitor: React.FC<{ rtspUrl: string }> = ({ rtspUrl }) => {
  const [isActive, setIsActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const proxyUrl = `/api/birds/proxy/live-audio?url=${encodeURIComponent(rtspUrl)}`;

  const toggleListening = () => {
    const nextActive = !isActive;
    setIsActive(nextActive);

    if (nextActive) {
      console.log('[Birds] Activating Live Yard Sentinel...');
      if (!sharedAudioCtx) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        sharedAudioCtx = new AudioContextClass();
      }

      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume();
      }

      if (audioRef.current) {
        audioRef.current.load();
        audioRef.current.play().catch(err => console.warn('[Birds] Live playback blocked:', err));
        setupAnalyzer();
      }
    } else {
      console.log('[Birds] Deactivating Live Yard Sentinel.');
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  const setupAnalyzer = () => {
    if (!audioRef.current || !sharedAudioCtx) return;

    try {
      if (!sharedAnalyzer) {
        const source = sharedAudioCtx.createMediaElementSource(audioRef.current);
        sharedAnalyzer = sharedAudioCtx.createAnalyser();
        sharedAnalyzer.fftSize = 256;
        source.connect(sharedAnalyzer);
        sharedAnalyzer.connect(sharedAudioCtx.destination);
      }
      startVisualization();
    } catch (err) {
      // source might already be connected, just start drawing
      startVisualization();
    }
  };

  const startVisualization = () => {
    if (!canvasRef.current || !sharedAnalyzer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = sharedAnalyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationRef.current = requestAnimationFrame(render);
      sharedAnalyzer!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // "Electric Blue" Gradient
        const hue = 190 + (i / bufferLength) * 40;
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;

        // Draw bars with rounded tops
        const r = 4;
        const h = Math.max(r * 2, barHeight);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, canvas.height - h, barWidth - 2, h, r);
        } else {
          ctx.rect(x, canvas.height - h, barWidth - 2, h);
        }
        ctx.fill();

        x += barWidth;
      }
    };

    render();
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-bottom duration-500 mb-8">
      <div className="flex flex-col md:flex-row h-full">
        <div className="flex-1 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <AudioWaveform className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Live Yard Sentinel</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Real-time Audio Spectrum Analysis</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isActive && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Active Stream</span>
                </div>
              )}
              <button
                onClick={toggleListening}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md ${
                  !isActive
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {!isActive ? <Volume2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                <span>{!isActive ? 'Listen Live' : 'Mute Sentinel'}</span>
              </button>
            </div>
          </div>

          <div className="relative h-32 bg-slate-950 rounded-2xl border border-slate-800/50 overflow-hidden flex items-center justify-center">
            {!isActive ? (
              <div className="flex flex-col items-center gap-2 text-slate-700">
                <Music className="w-8 h-8 opacity-20" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Monitor Standby</span>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={800}
                height={128}
                className="w-full h-full object-cover"
              />
            )}

            <audio
              ref={audioRef}
              src={proxyUrl}
              muted={!isActive}
              autoPlay
              crossOrigin="anonymous"
            />
          </div>
        </div>

        <div className="w-full md:w-64 bg-slate-950/50 border-l border-slate-800 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Source Node</span>
              <p className="text-xs font-mono font-bold text-blue-400 truncate">{rtspUrl.split('@').pop()?.split('/')[0] || 'ESP32-Audio'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Protocol</span>
              <p className="text-xs font-bold text-slate-300">RTSP &rarr; MP3 Proxy</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-600/5 border border-blue-500/10">
            <p className="text-[9px] text-slate-500 leading-relaxed font-medium italic text-center">
              Direct live audio verification from your yard microphone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const IntelligenceReportModal: React.FC<{ isOpen: boolean; onClose: () => void; sightings: BirdSighting[] }> = ({ isOpen, onClose, sightings }) => {
  if (!isOpen) return null;

  const speciesMap: Record<string, { common: string; scientific: string; count: number; maxConfidence: number; lastSeen: number }> = {};
  sightings.forEach(s => {
    if (!speciesMap[s.scientificName]) {
      speciesMap[s.scientificName] = { common: s.commonName, scientific: s.scientificName, count: 0, maxConfidence: 0, lastSeen: 0 };
    }
    speciesMap[s.scientificName].count += 1;
    speciesMap[s.scientificName].maxConfidence = Math.max(speciesMap[s.scientificName].maxConfidence, s.confidence);
    speciesMap[s.scientificName].lastSeen = Math.max(speciesMap[s.scientificName].lastSeen, s.timestamp);
  });

  const speciesList = Object.values(speciesMap).sort((a, b) => b.count - a.count);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-lg">
              <PieChart className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-white">Bio-Diversity Intelligence</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 border border-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Total Signals</span>
              <p className="text-3xl font-black text-white leading-none">{sightings.length}</p>
            </div>
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Species Diversity</span>
              <p className="text-3xl font-black text-blue-400 leading-none">{speciesList.length}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1 border-b border-slate-800 pb-2">Species Population Summary</h4>
            <div className="space-y-2">
              {speciesList.map((sp, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/40 border border-slate-800 hover:border-blue-500/30 transition-colors">
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">{sp.common}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{sp.scientific}</p>
                    <p className="text-[9px] text-slate-600 mt-1 uppercase font-black">Last Heard: {new Date(sp.lastSeen).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-blue-400 leading-none mb-1">{sp.count}x</p>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Max {Math.round(sp.maxConfidence * 100)}% Conf</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-950/80 border-t border-slate-800">
          <button onClick={onClose} className="w-full py-4 rounded-2xl bg-white text-slate-950 font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all shadow-xl">
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};

export const BirdSightingsView: React.FC<{ sightings: BirdSighting[]; config?: BirdNetConfig; onRefresh: () => void; onClear: () => void }> = ({ sightings, config, onRefresh, onClear }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const filteredSightings = sightings.filter((s) => {
    const matchesSearch = s.commonName.toLowerCase().includes(searchQuery.toLowerCase()) || s.scientificName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && s.confidence >= minConfidence;
  });

  const speciesCount = new Set(sightings.map((s) => s.scientificName)).size;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-400">
              <Bird className="w-5 h-5" />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Sightings Count</h4>
          </div>
          <p className="text-4xl font-black text-white leading-none">{sightings.length}</p>
          <p className="text-[10px] text-slate-500 mt-2 uppercase font-bold tracking-widest">Signals Processed Today</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Unique Species</h4>
          </div>
          <p className="text-4xl font-black text-white leading-none">{speciesCount}</p>
          <p className="text-[10px] text-slate-500 mt-2 uppercase font-bold tracking-widest">Biodiversity Score</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400">
                <Filter className="w-5 h-5" />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Filter Strength</h4>
            </div>
            <span className="text-xs font-mono font-bold text-white bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">{Math.round(minConfidence * 100)}%</span>
          </div>
          <input type="range" min="0.1" max="0.95" step="0.05" value={minConfidence} onChange={(e) => setMinConfidence(parseFloat(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-4" />
        </div>
      </div>

      {config?.enabled && config.liveAudioUrl && <LiveAudioMonitor rtspUrl={config.liveAudioUrl} />}

      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-md">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-4 top-3 w-4 h-4 text-slate-600" />
          <input type="text" placeholder="Search yard history..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors" />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsReportOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all active:scale-95">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Yard Report</span>
          </button>
          <button onClick={onRefresh} className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all active:scale-95 shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClear} className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all active:scale-95 shadow-sm">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filteredSightings.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center bg-slate-900/40 rounded-[2.5rem] border border-dashed border-slate-800 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 mb-6 shadow-inner">
            <Bird className="w-10 h-10 text-slate-800" />
          </div>
          <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm">Waiting for Activity</h3>
          <p className="text-slate-600 text-[10px] mt-2 max-w-[200px] uppercase font-bold tracking-widest leading-relaxed">Ensure BirdNET-Go is active and pushing MQTT telemetry.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSightings.map((s) => (
            <BirdSightingCard key={s.id} sighting={s} serverUrl={config?.serverUrl} />
          ))}
        </div>
      )}

      <IntelligenceReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} sightings={sightings} />
    </div>
  );
};

const BirdSightingCard: React.FC<{ sighting: BirdSighting; serverUrl?: string }> = ({ sighting, serverUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveAudioUrl = sighting.audioUrl || (serverUrl && sighting.id && !String(sighting.id).startsWith('bird-')
    ? `/api/birds/proxy/audio/${sighting.id}?serverUrl=${encodeURIComponent(serverUrl)}`
    : null);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!audioRef.current || !effectiveAudioUrl) {
      console.warn('[Birds] Audio clip unavailable or source missing');
      return;
    }

    console.log(`[Birds] Toggling audio for: ${sighting.commonName}. URL: ${effectiveAudioUrl}`);

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Force a full reload to ensure the proxy is hit and headers re-evaluated
      audioRef.current.load();
      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[Birds] Playback started');
            setIsPlaying(true);
          })
          .catch(err => {
            console.error('[Birds] Audio playback blocked or failed:', err);
            setIsPlaying(false);
          });
      }
    }
  };

  const formattedTime = new Date(sighting.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = new Date(sighting.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className="group bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-xl hover:border-blue-500/50 transition-all duration-500 flex flex-col hover:-translate-y-1">
      <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
        {sighting.imageUrl && sighting.imageUrl.startsWith('http') ? (
          <img src={sighting.imageUrl} alt={sighting.commonName} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />

        <div className="absolute top-4 right-4 z-20">
          <div className="px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-mono font-black text-emerald-400 shadow-lg">
            {Math.round(sighting.confidence * 100)}%
          </div>
        </div>

        <div className="absolute bottom-4 left-4 z-20 flex flex-col">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{formattedDate}</div>
          <div className="text-xs font-mono font-black text-white tracking-tighter">{formattedTime}</div>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-black text-white uppercase tracking-tight leading-tight group-hover:text-blue-400 transition-colors line-clamp-1">{sighting.commonName}</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 line-clamp-1">{sighting.scientificName}</p>
        </div>

        <div className="flex flex-col gap-2 mt-auto">
          {effectiveAudioUrl ? (
            <button
              onClick={toggleAudio}
              className={`w-full py-2.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
                isPlaying
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                  : 'bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white hover:border-blue-500'
              }`}
            >
              {isPlaying ? <X className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'Stop' : 'Listen to Clip'}</span>
              <audio ref={audioRef} src={effectiveAudioUrl} onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} crossOrigin="anonymous" />
            </button>
          ) : (
            <div className="w-full py-2.5 rounded-2xl bg-slate-800/40 text-slate-600 text-[10px] font-black uppercase tracking-widest text-center border border-transparent">
              No Clip Available
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">via {sighting.sourceNode}</span>
            <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(sighting.commonName)}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-colors" title="Wikipedia">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
