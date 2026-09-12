import React, { useState } from 'react';
import { FrigateEvent, CameraStream, MqttStatusInfo, ExclusionZone } from '../types';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Play,
  Pause,
  Clock,
  Sparkles,
  Shield,
  Trash2,
  Eye,
  Check,
  RotateCcw,
  Maximize2,
  Calendar,
  X,
  Camera,
  RefreshCw,
  Radio,
  Zap,
  ExternalLink,
  Sliders,
} from 'lucide-react';
import { SnapshotViewerModal } from './SnapshotViewerModal';
import { TenSecondPlaybackModal } from './TenSecondPlaybackModal';

interface EventsReviewProps {
  events: FrigateEvent[];
  cameras: CameraStream[];
  onMarkReviewed: (eventId: string) => void;
  onMarkAllReviewed: () => void;
  onClearAllEvents: () => void;
  onDeleteEvent: (eventId: string) => void;
  onUpdateEventAiSummary: (
    eventId: string,
    summary: string,
    threatLevel: 'low' | 'medium' | 'high',
    action: string
  ) => void;
  onRefreshEvents?: () => Promise<void>;
  isLiveServerConnected?: boolean;
  mqttStatus?: MqttStatusInfo;
  onSimulateMqttEvent?: () => Promise<void> | void;
  onOpenHostModal?: () => void;
  exclusionZones?: Record<string, ExclusionZone[]>;
}

export const EventsReview: React.FC<EventsReviewProps> = ({
  events,
  cameras,
  onMarkReviewed,
  onMarkAllReviewed,
  onClearAllEvents,
  onDeleteEvent,
  onUpdateEventAiSummary,
  onRefreshEvents,
  isLiveServerConnected = false,
  mqttStatus,
  onSimulateMqttEvent,
  onOpenHostModal,
  exclusionZones,
}) => {
  const [selectedImportance, setSelectedImportance] = useState<'all' | 'alert' | 'detection' | 'mqtt'>('all');
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [selectedLabel, setSelectedLabel] = useState<string>('all');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState<boolean>(false);
  const [inspectingEvent, setInspectingEvent] = useState<FrigateEvent | null>(null);
  const [snapshotEvent, setSnapshotEvent] = useState<FrigateEvent | null>(null);
  const [playbackEvent, setPlaybackEvent] = useState<FrigateEvent | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSendingTestMqtt, setIsSendingTestMqtt] = useState<boolean>(false);

  // Filter events
  const filteredEvents = events.filter((evt) => {
    if (selectedImportance === 'mqtt') {
      const isMqtt = evt.source === 'mqtt' || evt.summary?.includes('MQTT') || evt.id.startsWith('mqtt') || evt.id.startsWith('test-mqtt');
      if (!isMqtt) return false;
    } else if (selectedImportance !== 'all' && evt.importance !== selectedImportance) {
      return false;
    }
    if (selectedCamera !== 'all' && evt.camera !== selectedCamera) return false;
    if (selectedLabel !== 'all' && evt.label !== selectedLabel) return false;
    if (onlyUnreviewed && evt.reviewed) return false;
    return true;
  });

  const unreviewedCount = events.filter((e) => !e.reviewed).length;
  const mqttEventsCount = events.filter(
    (e) => e.source === 'mqtt' || e.summary?.includes('MQTT') || e.id.startsWith('mqtt') || e.id.startsWith('test-mqtt')
  ).length;

  const handleTestMqttClick = async () => {
    if (!onSimulateMqttEvent) return;
    setIsSendingTestMqtt(true);
    try {
      await onSimulateMqttEvent();
    } finally {
      setTimeout(() => setIsSendingTestMqtt(false), 800);
    }
  };

  // Request Gemini 3.8 Flash analysis for an event
  const handleAnalyzeWithGemini = async (evt: FrigateEvent) => {
    setIsAiLoading(true);
    try {
      const resp = await fetch('/api/gemini/describe-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera: evt.camera,
          label: evt.label,
          score: evt.score,
          zones: evt.zones,
          duration: evt.duration,
          time: new Date(evt.startTime).toLocaleTimeString(),
          contextInfo: `Bounding box normalized coordinates: x=${evt.box.x}, y=${evt.box.y}, w=${evt.box.width}, h=${evt.box.height}`,
        }),
      });
      const data = await resp.json();
      if (data.summary) {
        onUpdateEventAiSummary(
          evt.id,
          data.summary,
          data.threatLevel || 'low',
          data.recommendedAction || 'Normal surveillance verification.'
        );
        setInspectingEvent((prev) =>
          prev && prev.id === evt.id
            ? {
                ...prev,
                summary: data.summary,
                threatLevel: data.threatLevel || 'low',
                recommendedAction: data.recommendedAction,
                isAiAnalyzed: true,
              }
            : prev
        );
      }
    } catch (err) {
      console.error('Failed to analyze with Gemini', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefreshEvents) return;
    setIsRefreshing(true);
    try {
      await onRefreshEvents();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time MQTT Live Pipeline Status & Explainer Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1 rounded-xl text-xs uppercase tracking-wider font-bold bg-slate-950 border border-slate-800">
                <Radio
                  className={`w-3.5 h-3.5 ${
                    mqttStatus?.connected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
                  }`}
                />
                <span className={mqttStatus?.connected ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                  {mqttStatus?.connected
                    ? `MQTT Stream: Active (${mqttStatus.brokerUrl || 'Broker'})`
                    : mqttStatus?.connecting
                    ? 'MQTT Stream: Connecting...'
                    : 'MQTT Stream: Offline'}
                </span>
              </div>
              <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                Topic: <strong className="text-white font-mono">{mqttStatus?.topicPrefix || 'frigate'}/events</strong>
              </span>
              {mqttStatus?.messageCount !== undefined && mqttStatus.messageCount > 0 && (
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-950 text-emerald-400 border border-slate-800">
                  {mqttStatus.messageCount} packets received
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              <strong className="text-white font-black uppercase tracking-tight">Where do MQTT events appear?</strong> Live detection payloads from your Frigate broker are continuously pushed to this app in real-time. They are instantly logged to this <strong className="text-slate-200">Surveillance Review feed</strong>, pinned to the <strong className="text-slate-200">24-Hour Timeline Scrubber</strong> below, and trigger the <strong className="text-slate-200">Top Emergency Alert Banner</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onSimulateMqttEvent && (
              <button
                id="btn-simulate-mqtt-event"
                onClick={handleTestMqttClick}
                disabled={isSendingTestMqtt}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-40 shadow-md active:scale-95"
                title="Inject a test Frigate detection packet to verify real-time event reception"
              >
                <Zap className={`w-3.5 h-3.5 text-white ${isSendingTestMqtt ? 'animate-bounce' : ''}`} />
                <span>{isSendingTestMqtt ? 'Injecting...' : 'Send Test MQTT Event'}</span>
              </button>
            )}

            {onOpenHostModal && (
              <button
                onClick={onOpenHostModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">MQTT Settings</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 24-Hour Timeline Bar */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white" />
            <h3 className="text-xs uppercase tracking-[0.25em] font-black text-slate-400">
              24-Hour Recording & Event Scrubber
            </h3>
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            {events.length} Events • {unreviewedCount} Unreviewed
          </span>
        </div>

        {/* Visual Timeline Bar */}
        <div className="relative h-10 bg-slate-950 rounded-xl border border-slate-800 flex items-center px-2 overflow-hidden">
          {/* Hour markers */}
          <div className="absolute inset-0 flex justify-between px-3 text-[10px] font-mono font-bold text-slate-600 pointer-events-none items-end pb-1">
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
            <span>23:59</span>
          </div>

          {/* Render event ticks on timeline */}
          {events.map((evt) => {
            const date = new Date(evt.startTime);
            const hourDecimal = date.getHours() + date.getMinutes() / 60;
            const leftPct = (hourDecimal / 24) * 100;
            const isAlert = evt.importance === 'alert';

            return (
              <div
                key={evt.id}
                onClick={() => setPlaybackEvent(evt)}
                className={`absolute top-1 bottom-5 w-2 rounded-sm cursor-pointer hover:scale-150 transition-transform ${
                  isAlert ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : 'bg-white hover:bg-slate-200'
                }`}
                style={{ left: `${leftPct}%` }}
                title={`${evt.label} at ${date.toLocaleTimeString()} (${evt.camera}) - Click for 10s playback`}
              />
            );
          })}
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Importance Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedImportance('all')}
              className={`px-3.5 py-1.5 text-xs uppercase tracking-wider rounded-lg font-black transition-all ${
                selectedImportance === 'all'
                  ? 'bg-white text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedImportance('alert')}
              className={`px-3.5 py-1.5 text-xs uppercase tracking-wider rounded-lg font-black transition-all ${
                selectedImportance === 'alert'
                  ? 'bg-red-600 text-white font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Alerts
            </button>
            <button
              onClick={() => setSelectedImportance('detection')}
              className={`px-3.5 py-1.5 text-xs uppercase tracking-wider rounded-lg font-black transition-all ${
                selectedImportance === 'detection'
                  ? 'bg-white text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Detections
            </button>
            <button
              onClick={() => setSelectedImportance('mqtt')}
              className={`px-3.5 py-1.5 text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 font-black transition-all ${
                selectedImportance === 'mqtt'
                  ? 'bg-violet-600 text-white font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Show events received via MQTT broker"
            >
              <Radio className="w-3 h-3" />
              <span>MQTT Stream ({mqttEventsCount})</span>
            </button>
          </div>

          {/* Camera Filter Dropdown */}
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider outline-none focus:border-slate-600"
          >
            <option value="all">All Cameras ({cameras.length})</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Label Filter Dropdown */}
          <select
            value={selectedLabel}
            onChange={(e) => setSelectedLabel(e.target.value)}
            className="bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider outline-none focus:border-slate-600"
          >
            <option value="all">All Objects</option>
            <option value="person">Person</option>
            <option value="car">Car / Vehicle</option>
            <option value="package">Package / Delivery</option>
            <option value="dog">Dog</option>
            <option value="bicycle">Bicycle</option>
          </select>

          {/* Unreviewed Checkbox */}
          <button
            onClick={() => setOnlyUnreviewed(!onlyUnreviewed)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-colors ${
              onlyUnreviewed
                ? 'bg-white text-slate-950 font-black border-white shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <span>Unreviewed Only</span>
            {onlyUnreviewed && <span>✓</span>}
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {onRefreshEvents && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors disabled:opacity-40"
              title="Refresh events from active Frigate host"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-white' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync Events'}</span>
            </button>
          )}

          {unreviewedCount > 0 && (
            <button
              id="btn-mark-all-reviewed"
              onClick={onMarkAllReviewed}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-slate-950 hover:bg-slate-200 shadow-md transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-slate-950" />
              <span>Mark All Reviewed</span>
            </button>
          )}

          {events.length > 0 && (
            <button
              id="btn-clear-all-events"
              onClick={() => {
                if (window.confirm('Are you sure you want to permanently clear all surveillance events? This cannot be undone.')) {
                  onClearAllEvents();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 text-white hover:bg-red-500 shadow-md transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Events Grid / List */}
      {filteredEvents.length === 0 ? (
        <div className="p-16 text-center bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <p className="font-black uppercase tracking-tight text-xl text-white">No surveillance events found</p>
          <p className="text-xs text-slate-400 mt-2 font-medium">
            Try adjusting filters or checking live connection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => {
            const cameraObj = cameras.find((c) => c.id === evt.camera);
            const timeAgo = formatTimeAgo(evt.startTime);

            return (
              <div
                key={evt.id}
                id={`event-card-${evt.id}`}
                className="flex flex-col rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-xl"
              >
                {/* Event Card Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        evt.importance === 'alert'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-slate-800 text-white border border-slate-700'
                      }`}
                    >
                      {evt.importance.toUpperCase()}
                    </span>
                    {(evt.source === 'mqtt' || evt.summary?.includes('MQTT') || evt.id.startsWith('mqtt') || evt.id.startsWith('test-mqtt')) && (
                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-violet-950/80 text-violet-300 border border-violet-500/40 shrink-0 flex items-center gap-1">
                        <Radio className="w-2.5 h-2.5 text-violet-400" />
                        MQTT
                      </span>
                    )}
                    {evt.stationary && (
                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 shrink-0 flex items-center gap-1">
                        Parked
                      </span>
                    )}
                    <span className="text-white font-black text-sm uppercase tracking-tight truncate">
                      {evt.label} — {cameraObj?.name || evt.camera}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                    {timeAgo}
                  </span>
                </div>

                {/* Event Preview Container */}
                <div className="relative bg-black h-48 cursor-pointer group flex items-center justify-center overflow-hidden">
                  {evt.thumbnailUrl || evt.snapshotUrl ? (
                    <img
                      src={evt.thumbnailUrl || evt.snapshotUrl}
                      alt={`${evt.label} detection on ${evt.camera}`}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // Fallback to stylized vector representation if image endpoint returns error
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}

                  {/* Fallback & Overlay Elements */}
                  <div className="absolute inset-0 p-4 flex flex-col justify-between bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/60 pointer-events-none">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-300 font-black">
                      <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                        {evt.camera.toUpperCase()}
                      </span>
                      <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                        {new Date(evt.startTime).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-end justify-between text-[10px]">
                      <div className="bg-slate-950/85 px-3 py-1.5 rounded-xl border border-slate-800">
                        <span className="font-black text-white text-base tracking-tight">
                          {Math.round(evt.score * 100)}%
                        </span>
                        <span className="text-slate-400 font-bold uppercase text-[9px] ml-1.5">
                          {evt.label}
                        </span>
                      </div>

                      <span className="bg-slate-950/85 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-400 text-[10px] uppercase font-mono font-bold">
                        {evt.duration}s clip
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Overlay on Hover */}
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSnapshotEvent(evt);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider border border-slate-700 flex items-center gap-1.5 transition-colors shadow-lg"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Snapshot</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaybackEvent(evt);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-lg"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>10s Playback</span>
                    </button>
                  </div>
                </div>

                {/* AI Summary excerpt if available */}
                {evt.summary && (
                  <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="line-clamp-2 italic text-slate-400 text-xs font-medium">"{evt.summary}"</p>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-950/80 border-t border-slate-800 text-xs">
                  {/* Mark Reviewed */}
                  <button
                    onClick={() => onMarkReviewed(evt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      evt.reviewed
                        ? 'text-slate-400 bg-slate-900 border border-slate-800'
                        : 'text-slate-950 bg-white hover:bg-slate-200 font-black border border-white shadow-sm'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    <span>{evt.reviewed ? 'Reviewed' : 'Review'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Snapshot Button */}
                    <button
                      onClick={() => setSnapshotEvent(evt)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Snapshot View"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>

                    {/* 10s Playback Button */}
                    <button
                      onClick={() => setPlaybackEvent(evt)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="10-Second Playback"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>

                    {/* AI Brief / Inspector */}
                    <button
                      onClick={() => setInspectingEvent(evt)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="AI Analysis & Details"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteEvent(evt.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                      title="Delete Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Snapshot View Modal */}
      <SnapshotViewerModal
        isOpen={Boolean(snapshotEvent)}
        event={snapshotEvent}
        camera={cameras.find((c) => c.id === snapshotEvent?.camera)}
        onClose={() => setSnapshotEvent(null)}
        exclusionZones={snapshotEvent ? exclusionZones?.[snapshotEvent.camera] : undefined}
        onOpenPlayback={(evt) => {
          setSnapshotEvent(null);
          setPlaybackEvent(evt);
        }}
      />

      {/* 10-Second Video Playback Modal */}
      <TenSecondPlaybackModal
        isOpen={Boolean(playbackEvent)}
        event={playbackEvent}
        camera={cameras.find((c) => c.id === playbackEvent?.camera)}
        onClose={() => setPlaybackEvent(null)}
        exclusionZones={playbackEvent ? exclusionZones?.[playbackEvent.camera] : undefined}
        onOpenSnapshot={(evt) => {
          setPlaybackEvent(null);
          setSnapshotEvent(evt);
        }}
      />

      {/* Event Detail & AI Intelligence Inspector Modal */}
      {inspectingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    inspectingEvent.importance === 'alert'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-slate-800 text-white border border-slate-700'
                  }`}
                >
                  {inspectingEvent.importance.toUpperCase()}
                </span>
                <h3 className="text-lg font-black uppercase tracking-tight text-white">
                  {inspectingEvent.camera.toUpperCase()} — {inspectingEvent.label}
                </h3>
              </div>
              <button
                onClick={() => setInspectingEvent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Launch Buttons: Snapshot & 10s Playback */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950/60 border-b border-slate-800 text-xs">
              <span className="text-slate-400 text-xs font-mono font-bold">
                {new Date(inspectingEvent.startTime).toLocaleString()} • {inspectingEvent.duration}s clip
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const e = inspectingEvent;
                    setInspectingEvent(null);
                    setSnapshotEvent(e);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 text-xs uppercase font-bold"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Snapshot View</span>
                </button>
                <button
                  onClick={() => {
                    const e = inspectingEvent;
                    setInspectingEvent(null);
                    setPlaybackEvent(e);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs uppercase font-black"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>10s Playback</span>
                </button>
              </div>
            </div>

            {/* AI Security Analysis Section */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[360px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs uppercase tracking-[0.25em] font-black text-slate-400">
                    Gemini 3.8 Flash AI Vision Intelligence
                  </h4>
                </div>
                <button
                  id="btn-trigger-gemini-event-analysis"
                  onClick={() => handleAnalyzeWithGemini(inspectingEvent)}
                  disabled={isAiLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-black bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-50 transition-colors shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>{isAiLoading ? 'Analyzing...' : 'Generate AI Brief'}</span>
                </button>
              </div>

              {inspectingEvent.summary ? (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 uppercase tracking-wider font-black text-[11px]">
                      TACTICAL SUMMARY:
                    </span>
                    {inspectingEvent.threatLevel && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          inspectingEvent.threatLevel === 'high'
                            ? 'bg-red-500/30 text-red-300 border border-red-500/40'
                            : inspectingEvent.threatLevel === 'medium'
                            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-white border border-slate-700'
                        }`}
                      >
                        Threat Assessment: {inspectingEvent.threatLevel}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 leading-relaxed font-medium text-sm">{inspectingEvent.summary}</p>
                  {inspectingEvent.recommendedAction && (
                    <div className="pt-3 border-t border-slate-800 text-slate-300 font-medium">
                      <span className="text-slate-400 uppercase tracking-wider text-[10px] font-black">
                        Recommended Action:{' '}
                      </span>
                      {inspectingEvent.recommendedAction}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-center text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Click "Generate AI Brief" to analyze this event with Gemini 3.8 Flash vision intelligence.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800 text-xs">
              <button
                onClick={() => {
                  onMarkReviewed(inspectingEvent.id);
                  setInspectingEvent((prev) => (prev ? { ...prev, reviewed: true } : prev));
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 uppercase tracking-wider font-bold"
              >
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Mark Reviewed</span>
              </button>

              <button
                onClick={() => {
                  onDeleteEvent(inspectingEvent.id);
                  setInspectingEvent(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-red-400 hover:bg-red-950/40 border border-red-500/20 transition-colors uppercase tracking-wider font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Event</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
