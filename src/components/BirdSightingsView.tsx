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
} from 'lucide-react';

const LiveAudioMonitor: React.FC<{ rtspUrl: string }> = ({ rtspUrl }) => {
  const [isListening, setIsMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const proxyUrl = `/api/birds/proxy/live-audio?url=${encodeURIComponent(rtspUrl)}`;

  useEffect(() => {
    // When listening state changes, log it to the console for debugging
    if (!isListening) {
      console.log(`[Birds] Attempting to listen to live audio: ${proxyUrl}`);
    }
  }, [isListening, proxyUrl]);

  const toggleListening = () => {
    if (isListening) {
      // START LISTENING
      setIsMuted(false);

      if (!audioContextRef.current) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        audioContextRef.current = new AudioContextClass();
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      if (audioRef.current) {
        audioRef.current.load(); // Force fresh stream connection
        audioRef.current.play().catch(err => console.warn('[Birds] Playback blocked:', err));
      }

      setupAnalyzer();
    } else {
      // STOP LISTENING
      setIsMuted(true);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  const setupAnalyzer = () => {
    if (!audioRef.current || !audioContextRef.current) return;

    if (!analyzerRef.current) {
      const source = audioContextRef.current.createMediaElementSource(audioRef.current);
      const analyzer = audioContextRef.current.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      analyzer.connect(audioContextRef.current.destination);
      analyzerRef.current = analyzer;
    }

    drawSpectrogram();
  };

  const drawSpectrogram = () => {
    if (!canvasRef.current || !analyzerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationRef.current = requestAnimationFrame(render);
      analyzerRef.current!.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0f172a'; // matches bg
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Color based on frequency
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.8)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    render();
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-bottom duration-500">
      <div className="flex flex-col md:flex-row h-full">
        {/* Visualizer Panel */}
        <div className="flex-1 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Live Yard Sentinel</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Real-time Audio Spectrum Analysis</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isListening && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live Monitoring</span>
                </div>
              )}
              <button
                onClick={toggleListening}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isListening
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {isListening ? <Volume2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                <span>{isListening ? 'Listen Live' : 'Mute Sentinel'}</span>
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-[120px] bg-slate-950 rounded-2xl border border-slate-800/50 overflow-hidden flex items-center justify-center">
            {isListening ? (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <AudioWaveform className="w-8 h-8 opacity-20" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Monitor Standby</span>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full h-full object-cover opacity-80"
              />
            )}

            <audio
              ref={audioRef}
              src={proxyUrl}
              muted={isListening}
              autoPlay
              crossOrigin="anonymous"
            />
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="w-full md:w-64 bg-slate-950/50 border-l border-slate-800 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Source Node</span>
              <p className="text-xs font-mono font-bold text-blue-400 truncate">{rtspUrl.split('@').pop()?.split('/')[0] || 'ESP32-Audio-Server'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Encoding</span>
              <p className="text-xs font-bold text-slate-300">PCM_S16LE &rarr; MP3 Relay</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Health</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-500">Stream Nominal</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-600/5 border border-blue-500/20">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Zap className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase">Pro Tip</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-relaxed font-medium">
              Listening live helps verify low-confidence detections or manual captures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BirdSightingsViewProps {
  sightings: BirdSighting[];
  config?: BirdNetConfig;
  onRefresh: () => void;
  onClear: () => void;
}

export const BirdSightingsView: React.FC<BirdSightingsViewProps> = ({
  sightings,
  config,
  onRefresh,
  onClear,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.5);

  const filteredSightings = sightings.filter((s) => {
    const matchesSearch =
      s.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.scientificName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesConfidence = s.confidence >= minConfidence;
    return matchesSearch && matchesConfidence;
  });

  const speciesCount = new Set(sightings.map((s) => s.scientificName)).size;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-400">
              <Bird className="w-5 h-5" />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Total Sightings</h4>
          </div>
          <p className="text-3xl font-black text-white">{sightings.length}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Across all monitored nodes</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Unique Species</h4>
          </div>
          <p className="text-3xl font-black text-white">{speciesCount}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Identified via audio AI</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400">
                <Filter className="w-5 h-5" />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Confidence Floor</h4>
            </div>
            <span className="text-xs font-mono font-bold text-white">{Math.round(minConfidence * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.95"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-4"
          />
        </div>
      </div>

      {config?.enabled && config.liveAudioUrl && (
        <LiveAudioMonitor rtspUrl={config.liveAudioUrl} />
      )}

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search species name (e.g. 'Blue Jay')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Log</span>
          </button>
        </div>
      </div>

      {/* Sightings Grid */}
      {filteredSightings.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800 mb-4">
            <Bird className="w-8 h-8 text-slate-700" />
          </div>
          <h3 className="text-white font-black uppercase tracking-widest text-sm">No Sightings Found</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-[240px]">
            Adjust your filters or ensure BirdNET-Go is transmitting MQTT data.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSightings.map((s) => (
            <BirdSightingCard key={s.id} sighting={s} />
          ))}
        </div>
      )}
    </div>
  );
};

const BirdSightingCard: React.FC<{ sighting: BirdSighting }> = ({ sighting }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const formattedTime = new Date(sighting.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const formattedDate = new Date(sighting.timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:border-blue-500/50 transition-all duration-300 flex flex-col">
      <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Bird Image with Wikipedia Thumbnail */}
        {sighting.imageUrl && sighting.imageUrl.startsWith('http') ? (
          <img
            src={sighting.imageUrl}
            alt={sighting.commonName}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
          {(!sighting.imageUrl || !sighting.imageUrl.startsWith('http')) && (
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
              <Bird className="w-8 h-8 text-blue-400" />
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase text-blue-400 tracking-widest shadow-lg">
            <Volume2 className={`w-3 h-3 ${isPlaying ? 'animate-pulse' : ''}`} />
            {isPlaying ? 'Playing...' : 'Audio Match'}
          </div>
        </div>

        {/* Play Button Overlay (if audioUrl exists) */}
        {sighting.audioUrl && (
          <div
            onClick={toggleAudio}
            className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
              {isPlaying ? <X className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </div>
            <audio
              ref={audioRef}
              src={sighting.audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        )}

        {/* Confidence Badge */}
        <div className="absolute top-3 right-3 z-20">
          <div className="px-2 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono font-bold text-emerald-400">
            {Math.round(sighting.confidence * 100)}%
          </div>
        </div>

        {/* Timestamp HUD */}
        <div className="absolute bottom-3 left-3 z-20 flex flex-col">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {formattedDate}
          </div>
          <div className="text-xs font-mono font-bold text-white tracking-tighter">
            {formattedTime}
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight group-hover:text-blue-400 transition-colors">
            {sighting.commonName}
          </h3>
          <p className="text-[10px] text-slate-500 italic font-medium mt-0.5">
            {sighting.scientificName}
          </p>
        </div>

        <div className="mt-auto pt-3 border-t border-slate-800/50 flex items-center justify-between">
          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
            via {sighting.sourceNode}
          </span>
          <a
            href={sighting.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="View species on Wikipedia"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
