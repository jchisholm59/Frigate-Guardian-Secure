import React, { useState, useEffect } from 'react';
import {
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Radio,
  Plus,
  Trash2,
  Cpu,
  Camera,
  Shield,
  Key,
  Globe,
  Activity,
  Check,
  Zap,
  ChevronDown,
  ChevronRight,
  Info,
  Terminal,
  Sliders,
  Send,
  Mail,
  Bell,
  Eye,
  EyeOff,
} from 'lucide-react';
import { FrigateServerConfig, MqttCredentials, MqttStatusInfo, NotificationSettings } from '../types';
import { NotificationSettingsView } from './NotificationSettingsView';

interface HostConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: FrigateServerConfig[];
  activeServerId: string;
  onSelectServer: (serverId: string) => void;
  onAddServer: (server: FrigateServerConfig) => Promise<void>;
  onDeleteServer: (serverId: string) => void;
  onUpdateServer?: (server: FrigateServerConfig) => void;
  onSyncServerCameras: (server: FrigateServerConfig) => Promise<void>;
  notificationSettings?: NotificationSettings;
  onUpdateNotificationSettings?: (settings: NotificationSettings) => void;
  dummyCamerasEnabled?: boolean;
  onToggleDummyCameras?: (enabled: boolean) => void;
  onRestoreDummyServer?: () => void;
  availableCameras?: { id: string; name: string }[];
  initialTab?: 'servers' | 'notifications' | 'mqtt';
}

export const HostConnectorModal: React.FC<HostConnectorModalProps> = ({
  isOpen,
  onClose,
  servers,
  activeServerId,
  onSelectServer,
  onAddServer,
  onDeleteServer,
  onSyncServerCameras,
  notificationSettings,
  onUpdateNotificationSettings,
  dummyCamerasEnabled = true,
  onToggleDummyCameras,
  onRestoreDummyServer,
  availableCameras = [],
  initialTab = 'servers',
}) => {
  const [activeModalTab, setActiveModalTab] = useState<'servers' | 'notifications' | 'mqtt'>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveModalTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [name, setName] = useState('');
  // Starts empty (the format hint lives in the placeholder below) — a
  // real pre-filled value here reads as normal typed text, so clicking in
  // and typing without first selecting-all inserts into it instead of
  // replacing it, producing a garbled concatenated URL that can never
  // connect (e.g. "http://localhost:500http://<real-ip>:5000").
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  // MQTT form state
  const [mqttEnabled, setMqttEnabled] = useState(true);
  // Empty, not 'localhost' — same reasoning as the server URL field above:
  // a real value here looks like normal typed text (invites the same
  // concatenation bug) and, since it's almost never actually correct for a
  // new server, silently getting left at 'localhost' is its own footgun.
  // Bonus: this also un-breaks the `!mqttHost` auto-fill-from-probe check
  // below, which could never fire while this defaulted to a truthy value.
  const [mqttHost, setMqttHost] = useState('');
  const [mqttPort, setMqttPort] = useState(1883);
  const [mqttProtocol, setMqttProtocol] = useState<'mqtt' | 'mqtts' | 'ws' | 'wss'>('mqtt');
  const [mqttTopic, setMqttTopic] = useState('frigate');
  const [mqttUser, setMqttUser] = useState('');
  const [mqttPass, setMqttPass] = useState('');

  // Diagnostics & live stream state
  const [mqttLiveStatus, setMqttLiveStatus] = useState<MqttStatusInfo | null>(null);
  const [recentPackets, setRecentPackets] = useState<any[]>([]);
  const [isFetchingPackets, setIsFetchingPackets] = useState(false);
  const [isInjectingTestEvent, setIsInjectingTestEvent] = useState(false);
  const [testEventFeedback, setTestEventFeedback] = useState<string | null>(null);
  const [expandedPacketId, setExpandedPacketId] = useState<string | null>(null);
  const [isConnectingBroker, setIsConnectingBroker] = useState(false);

  // Test states
  const [isProbingServer, setIsProbingServer] = useState(false);
  const [serverProbeResult, setServerProbeResult] = useState<{
    success?: boolean;
    version?: string;
    cameraCount?: number;
    cameras?: string[];
    detectors?: string[];
    error?: string;
  } | null>(null);

  const [isTestingMqtt, setIsTestingMqtt] = useState(false);
  const [mqttTestResult, setMqttTestResult] = useState<{
    success?: boolean;
    message?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  const fetchMqttDiagnostics = async () => {
    setIsFetchingPackets(true);
    try {
      const [statusRes, msgsRes] = await Promise.all([
        fetch('/api/frigate/mqtt/status').then((r) => r.json()).catch(() => ({})),
        fetch('/api/frigate/mqtt/recent-messages').then((r) => r.json()).catch(() => ({})),
      ]);
      if (statusRes.status) setMqttLiveStatus(statusRes.status);
      if (msgsRes.packets) setRecentPackets(msgsRes.packets);
    } catch (e) {
      console.warn('Error fetching MQTT diagnostics:', e);
    } finally {
      setIsFetchingPackets(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchMqttDiagnostics();
    if (activeModalTab === 'mqtt') {
      const interval = setInterval(fetchMqttDiagnostics, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeModalTab]);

  if (!isOpen) return null;

  // Test Server & discover cameras
  const handleProbeServer = async () => {
    if (!url.trim()) return;
    setIsProbingServer(true);
    setServerProbeResult(null);

    try {
      const resp = await fetch('/api/frigate/servers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), apiKey: apiKey.trim() || undefined }),
      });
      const data = await resp.json();
      if (data.success) {
        setServerProbeResult({
          success: true,
          version: data.version,
          cameraCount: data.cameraCount || 0,
          cameras: data.cameras || [],
          detectors: data.detectors || [],
        });
        // Auto fill MQTT if discovered in Frigate's YAML
        if (data.mqttFromConfig && !mqttHost) {
          if (data.mqttFromConfig.host) setMqttHost(data.mqttFromConfig.host);
          if (data.mqttFromConfig.port) setMqttPort(data.mqttFromConfig.port);
          if (data.mqttFromConfig.topic_prefix) setMqttTopic(data.mqttFromConfig.topic_prefix);
        }
      } else {
        setServerProbeResult({
          success: false,
          error: data.error || 'Unable to connect to Frigate server.',
        });
      }
    } catch (err: any) {
      setServerProbeResult({
        success: false,
        error: err.message || 'Network request failed',
      });
    } finally {
      setIsProbingServer(false);
    }
  };

  // Test MQTT Credentials
  const handleTestMqtt = async () => {
    if (!mqttHost.trim()) return;
    setIsTestingMqtt(true);
    setMqttTestResult(null);

    try {
      const resp = await fetch('/api/frigate/mqtt/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerHost: mqttHost.trim(),
          port: mqttPort,
          protocol: mqttProtocol,
          topicPrefix: mqttTopic.trim() || 'frigate',
          username: mqttUser.trim() || undefined,
          password: mqttPass.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setMqttTestResult({
          success: true,
          message: data.message,
          latencyMs: data.latencyMs,
        });
      } else {
        setMqttTestResult({
          success: false,
          error: data.error || 'Failed to authenticate with MQTT broker.',
        });
      }
    } catch (err: any) {
      setMqttTestResult({
        success: false,
        error: err.message || 'MQTT test request failed',
      });
    } finally {
      setIsTestingMqtt(false);
    }
  };

  // Save new server
  const handleSaveNewServer = async () => {
    if (!name.trim() || !url.trim()) return;

    const newServer: FrigateServerConfig = {
      id: `srv-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      url: url.trim().replace(/\/$/, ''),
      apiKey: apiKey.trim() || undefined,
      status: 'connected',
      version: serverProbeResult?.version || 'v0.14.x',
      detectedCamerasCount: serverProbeResult?.cameraCount || 0,
      lastSeen: Date.now(),
      mqtt: {
        enabled: mqttEnabled,
        brokerHost: mqttHost.trim(),
        port: mqttPort,
        protocol: mqttProtocol,
        topicPrefix: mqttTopic.trim() || 'frigate',
        username: mqttUser.trim() || undefined,
        password: mqttPass.trim() || undefined,
        connected: mqttTestResult?.success || false,
      },
    };

    setIsSyncing(true);
    try {
      await onAddServer(newServer);
      setIsAddingNew(false);
      setName('');
      setServerProbeResult(null);
      setMqttTestResult(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerSimulateEvent = async (cameraName = 'driveway', label = 'person') => {
    setIsInjectingTestEvent(true);
    setTestEventFeedback(null);
    try {
      const res = await fetch('/api/frigate/mqtt/simulate-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera: cameraName,
          label: label,
          score: 0.94,
          zone: 'driveway_zone',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestEventFeedback(
          `Success: Test event for "${label}" on camera "${cameraName}" broadcasted! Check Review tab, 24h timeline scrubber, and top alert toast.`
        );
        fetchMqttDiagnostics();
      } else {
        setTestEventFeedback(`Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setTestEventFeedback(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsInjectingTestEvent(false);
    }
  };

  const handleConnectMqttBroker = async () => {
    setIsConnectingBroker(true);
    try {
      await fetch('/api/frigate/mqtt/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerHost: mqttHost.trim(),
          port: mqttPort,
          protocol: mqttProtocol,
          topicPrefix: mqttTopic.trim() || 'frigate',
          username: mqttUser.trim() || undefined,
          password: mqttPass.trim() || undefined,
          frigateServerUrl: url.trim(),
        }),
      });
      fetchMqttDiagnostics();
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnectingBroker(false);
    }
  };

  const handleDisconnectMqttBroker = async () => {
    try {
      await fetch('/api/frigate/mqtt/disconnect', { method: 'POST' });
      fetchMqttDiagnostics();
    } catch (err) {}
  };

  const activeServer = servers.find((s) => s.id === activeServerId) || servers[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-white" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-black">
                Surveillance Infrastructure
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">
                Frigate Servers & MQTT Fleet
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Subtabs */}
        <div className="flex items-center px-6 pt-3 bg-slate-950 border-b border-slate-800 gap-4 overflow-x-auto">
          <button
            id="tab-servers"
            onClick={() => setActiveModalTab('servers')}
            className={`px-3.5 py-2.5 text-xs uppercase tracking-wider font-black border-b-2 transition-all whitespace-nowrap ${
              activeModalTab === 'servers'
                ? 'border-white text-white font-black'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Frigate Servers ({servers.length})
          </button>
          <button
            id="tab-notifications"
            onClick={() => setActiveModalTab('notifications')}
            className={`px-3.5 py-2.5 text-xs uppercase tracking-wider font-black border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeModalTab === 'notifications'
                ? 'border-red-500 text-red-300 font-black'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-red-400" />
            <span>Event Notifications (Gmail • Slack • Discord)</span>
            {(notificationSettings?.gmail.enabled ||
              notificationSettings?.slack.enabled ||
              notificationSettings?.discord.enabled) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
          <button
            id="tab-mqtt-inspector"
            onClick={() => {
              setActiveModalTab('mqtt');
              fetchMqttDiagnostics();
            }}
            className={`px-3.5 py-2.5 text-xs uppercase tracking-wider font-black border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeModalTab === 'mqtt'
                ? 'border-violet-500 text-violet-300 font-black'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live MQTT Inspector</span>
            {mqttLiveStatus?.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs font-sans">
          {activeModalTab === 'servers' && (
            <div className="space-y-6">
          {/* Active Server Summary Pill */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black uppercase tracking-tight text-white text-base">{activeServer?.name}</span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    Active Target
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium pt-1">
                  Endpoint: <span className="text-slate-200 font-mono">{activeServer?.url}</span> • MQTT Broker: <span className="text-slate-200 font-mono">{activeServer?.mqtt?.enabled ? `${activeServer.mqtt.brokerHost}:${activeServer.mqtt.port} (${activeServer.mqtt.topicPrefix}/#)` : 'Disabled'}</span>
                </p>
              </div>
            </div>

            {!activeServer?.isSimulated && (
              <button
                onClick={async () => {
                  setIsSyncing(true);
                  try {
                    await onSyncServerCameras(activeServer);
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 text-xs uppercase tracking-wider font-bold transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronizing...' : 'Resync Feeds'}</span>
              </button>
            )}
          </div>

          {/* Dummy Camera Feeds & Simulation Option Control */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-black text-white tracking-wider">
                      Dummy Cameras (Simulation Engine)
                    </span>
                    <span
                      className={`text-[10px] uppercase px-2 py-0.5 rounded-lg font-black ${
                        dummyCamerasEnabled
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {dummyCamerasEnabled ? 'Active / Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Provides 6 simulated dummy camera feeds (Driveway, Porch, Backyard, Street, Garage, Gate) for testing.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle switch */}
                <button
                  id="btn-toggle-dummy-cameras"
                  onClick={() => onToggleDummyCameras && onToggleDummyCameras(!dummyCamerasEnabled)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider font-black transition-all border ${
                    dummyCamerasEnabled
                      ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
                      : 'bg-emerald-600 border-emerald-500 text-white font-black hover:bg-emerald-500 shadow-md'
                  }`}
                >
                  {dummyCamerasEnabled ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      <span>Disable Dummy Feeds</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-white" />
                      <span>Enable Dummy Feeds</span>
                    </>
                  )}
                </button>

                {/* Remove or restore simulated server */}
                {servers.some((s) => s.isSimulated) ? (
                  <button
                    id="btn-remove-dummy-server"
                    onClick={() => {
                      const sim = servers.find((s) => s.isSimulated);
                      if (sim) onDeleteServer(sim.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/30 text-xs uppercase tracking-wider font-bold transition-colors"
                    title="Remove the dummy simulation engine completely"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Remove Dummy Server</span>
                  </button>
                ) : (
                  onRestoreDummyServer && (
                    <button
                      id="btn-restore-dummy-server"
                      onClick={onRestoreDummyServer}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs uppercase tracking-wider font-black transition-colors shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Restore Dummy Engine</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Configured Servers List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
                Configured Frigate Nodes ({servers.length})
              </span>
              {!isAddingNew && (
                <button
                  id="btn-add-frigate-server"
                  onClick={() => setIsAddingNew(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs uppercase tracking-wider font-black transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Frigate Server</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {servers.map((srv) => {
                const isActive = srv.id === activeServerId;
                return (
                  <div
                    key={srv.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-slate-950 border-white shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          isActive ? 'bg-emerald-400' : 'bg-slate-600'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black uppercase tracking-tight text-white text-sm truncate">
                            {srv.name}
                          </span>
                          {srv.isSimulated ? (
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                              Simulated Engine
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold">
                              Live Node
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-1 font-mono">
                          {srv.url}
                          {srv.mqtt?.enabled && ` • MQTT: ${srv.mqtt.brokerHost}:${srv.mqtt.port}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isActive ? (
                        <button
                          onClick={() => onSelectServer(srv.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs uppercase tracking-wider font-black transition-colors shadow-sm"
                        >
                          Connect
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-emerald-400 text-xs uppercase tracking-wider font-black border border-slate-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      )}

                      <button
                        id={`btn-delete-server-${srv.id}`}
                        onClick={() => onDeleteServer(srv.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                        title={srv.isSimulated ? "Remove dummy camera server" : "Remove server"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Server Drawer / Form */}
          {isAddingNew && (
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 animate-in slide-in-from-bottom duration-200 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-white" />
                  <span className="text-sm font-black uppercase tracking-tight text-white">Add New Frigate Server</span>
                </div>
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>

              {/* Server Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                    Server Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Primary Home Frigate"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-medium outline-none focus:border-white transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                    Server Base URL *
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://192.168.1.100:5000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-medium outline-none focus:border-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                  Optional Auth Token / Reverse Proxy Header
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Optional Bearer token or proxy key"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-medium outline-none focus:border-white transition-colors"
                />
              </div>

              {/* Server Probe Button & Results */}
              <div className="pt-1">
                <button
                  onClick={handleProbeServer}
                  disabled={isProbingServer || !url.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 text-xs uppercase tracking-wider font-bold transition-colors disabled:opacity-40"
                >
                  <Activity className={`w-3.5 h-3.5 ${isProbingServer ? 'animate-spin' : ''}`} />
                  <span>{isProbingServer ? 'Probing Frigate Host...' : 'Probe & Discover Cameras'}</span>
                </button>

                {serverProbeResult && (
                  <div
                    className={`mt-3 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                      serverProbeResult.success
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/60 border-red-500/40 text-red-200'
                    }`}
                  >
                    {serverProbeResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    )}
                    <div className="space-y-1">
                      {serverProbeResult.success ? (
                        <>
                          <div className="font-black uppercase tracking-wider text-emerald-300">
                            Frigate {serverProbeResult.version} Connected!
                          </div>
                          <div className="font-medium">
                            Discovered {serverProbeResult.cameraCount} cameras:{' '}
                            <span className="text-white font-mono font-bold">
                              {serverProbeResult.cameras?.join(', ') || 'none'}
                            </span>
                          </div>
                          {serverProbeResult.detectors && serverProbeResult.detectors.length > 0 && (
                            <div className="text-[10px] text-emerald-300 font-mono">
                              Detectors: {serverProbeResult.detectors.join(', ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="font-medium">{serverProbeResult.error}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* MQTT Ingestion Credentials Section */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-white" />
                    <span className="text-xs uppercase tracking-wider font-black text-white">
                      MQTT Event Ingestion Engine
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-[10px] uppercase font-bold text-slate-400">
                    <input
                      type="checkbox"
                      checked={mqttEnabled}
                      onChange={(e) => setMqttEnabled(e.target.checked)}
                      className="rounded accent-white"
                    />
                    <span>Use Frigate MQTT</span>
                  </label>
                </div>

                {mqttEnabled && (
                  <div className="space-y-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Broker Host / IP *
                        </label>
                        <input
                          type="text"
                          value={mqttHost}
                          onChange={(e) => setMqttHost(e.target.value)}
                          placeholder="192.168.1.100 or mqtt.local"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Port *
                        </label>
                        <input
                          type="number"
                          value={mqttPort}
                          onChange={(e) => setMqttPort(parseInt(e.target.value) || 1883)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Protocol
                        </label>
                        <select
                          value={mqttProtocol}
                          onChange={(e) => setMqttProtocol(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                        >
                          <option value="mqtt">MQTT (TCP - Port 1883)</option>
                          <option value="mqtts">MQTTS (TLS - Port 8883)</option>
                          <option value="ws">WebSocket (WS - Port 9001)</option>
                          <option value="wss">Secure WebSocket (WSS)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Topic Prefix
                        </label>
                        <input
                          type="text"
                          value={mqttTopic}
                          onChange={(e) => setMqttTopic(e.target.value)}
                          placeholder="frigate"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Username (Optional)
                        </label>
                        <input
                          type="text"
                          value={mqttUser}
                          onChange={(e) => setMqttUser(e.target.value)}
                          placeholder="mqtt_user"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Password (Optional)
                        </label>
                        <input
                          type="password"
                          value={mqttPass}
                          onChange={(e) => setMqttPass(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <button
                        onClick={handleTestMqtt}
                        disabled={isTestingMqtt || !mqttHost.trim()}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white border border-slate-800 text-xs uppercase tracking-wider font-bold transition-colors disabled:opacity-40"
                      >
                        {isTestingMqtt ? 'Testing Handshake...' : 'Verify MQTT Connection'}
                      </button>
                      {mqttTestResult && (
                        <span
                          className={`text-xs font-mono font-bold ${
                            mqttTestResult.success ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {mqttTestResult.success
                            ? `✓ Broker Connected (${mqttTestResult.latencyMs}ms)`
                            : `✗ ${mqttTestResult.error}`}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 text-xs uppercase tracking-wider font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewServer}
                  disabled={!name.trim() || !url.trim() || isSyncing}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-200 disabled:opacity-40 text-slate-950 text-xs uppercase tracking-wider font-black transition-colors shadow-md active:scale-95"
                >
                  {isSyncing ? 'Connecting & Ingesting...' : 'Save & Connect Server'}
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {/* Notifications Panel (Gmail, Slack, Discord) */}
        {activeModalTab === 'notifications' && (
          <div className="space-y-4">
            {notificationSettings && onUpdateNotificationSettings ? (
              <NotificationSettingsView
                settings={notificationSettings}
                onUpdateSettings={onUpdateNotificationSettings}
                availableCameras={availableCameras}
              />
            ) : (
              <div className="p-6 text-center text-zinc-400 font-mono">
                Notification settings are loading or unavailable.
              </div>
            )}
          </div>
        )}

        {/* Live MQTT Diagnostics, Stream & Education Panel */}
        {activeModalTab === 'mqtt' && (
          <div className="space-y-6">
            {/* Broker Status & Quick Actions */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                      mqttLiveStatus?.connected
                        ? 'bg-emerald-400 animate-pulse'
                        : mqttLiveStatus?.connecting
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-slate-600'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black uppercase tracking-tight text-white text-base">
                        {mqttLiveStatus?.connected ? 'MQTT Broker Live & Subscribed' : 'MQTT Broker Offline / Disconnected'}
                      </span>
                      <span
                        className={`text-[10px] uppercase px-2 py-0.5 rounded-lg border font-black ${
                          mqttLiveStatus?.connected
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {mqttLiveStatus?.connected ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono pt-1">
                      Endpoint: <strong className="text-white">{mqttLiveStatus?.brokerUrl || `${mqttProtocol}://${mqttHost}:${mqttPort}`}</strong> • Topic: <strong className="text-white">{mqttLiveStatus?.topicPrefix || mqttTopic}/#</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchMqttDiagnostics}
                    disabled={isFetchingPackets}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    title="Refresh MQTT state"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingPackets ? 'animate-spin' : ''}`} />
                  </button>
                  {mqttLiveStatus?.connected ? (
                    <button
                      onClick={handleDisconnectMqttBroker}
                      className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/30 text-xs uppercase font-black tracking-wider transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectMqttBroker}
                      disabled={isConnectingBroker}
                      className="px-3.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 text-xs uppercase font-black tracking-wider transition-colors disabled:opacity-40"
                    >
                      {isConnectingBroker ? 'Connecting...' : 'Connect Broker'}
                    </button>
                  )}
                </div>
              </div>

              {/* Live Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-800 text-xs font-mono">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Packets Captured</div>
                  <div className="text-base font-black text-white mt-0.5">{mqttLiveStatus?.messageCount || 0}</div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Active Topics</div>
                  <div className="text-xs text-white truncate mt-0.5 font-black">{mqttLiveStatus?.topicPrefix || 'frigate'}/events, reviews</div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Last Packet</div>
                  <div className="text-xs text-white truncate mt-0.5">
                    {mqttLiveStatus?.lastReceivedAt
                      ? new Date(mqttLiveStatus.lastReceivedAt).toLocaleTimeString()
                      : 'None yet'}
                  </div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Subscriber ID</div>
                  <div className="text-xs text-slate-300 truncate mt-0.5">watchtower</div>
                </div>
              </div>

              {mqttLiveStatus?.error && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{mqttLiveStatus.error}</span>
                </div>
              )}
            </div>

            {/* Test Event Injection Widget */}
            <div className="p-5 rounded-2xl bg-violet-950/25 border border-violet-500/30 space-y-3 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <span className="font-black uppercase tracking-tight text-white text-sm">Send Test Detection Packet</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Simulate a Frigate <code className="text-violet-300 font-mono font-bold">/events</code> message to verify instant pipeline ingestion, badges, and alerts.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTriggerSimulateEvent('driveway', 'person')}
                    disabled={isInjectingTestEvent}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs uppercase font-black tracking-wider transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isInjectingTestEvent ? 'Injecting...' : 'Simulate Person Event'}</span>
                  </button>
                  <button
                    onClick={() => handleTriggerSimulateEvent('front_porch', 'car')}
                    disabled={isInjectingTestEvent}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 text-xs uppercase tracking-wider font-black transition-colors disabled:opacity-40"
                  >
                    <span>Simulate Car</span>
                  </button>
                </div>
              </div>

              {testEventFeedback && (
                <div className="p-3 rounded-xl bg-slate-950 border border-violet-500/40 text-violet-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{testEventFeedback}</span>
                </div>
              )}
            </div>

            {/* Visual Guide: Where Are MQTT Events Displayed? */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-md">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-white" />
                <h4 className="text-xs uppercase tracking-[0.2em] font-black text-white">
                  Where are MQTT events displayed in this application?
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-white font-black uppercase tracking-tight flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    <span>1. Surveillance Review Feed</span>
                  </div>
                  <p>
                    Incoming <code className="text-slate-200 font-mono">frigate/events</code> messages are normalized into detection cards, tagged with a violet <span className="text-violet-300 font-black">[MQTT LIVE]</span> badge, and prepended to the top of the feed immediately.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-white font-black uppercase tracking-tight flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span>2. 24-Hour Timeline Scrubber</span>
                  </div>
                  <p>
                    Each MQTT event drops a clickable marker onto the 24-hour timeline bar at its exact timestamp. Clicking it opens the 10-second playback modal.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-white font-black uppercase tracking-tight flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>3. Perimeter Emergency Alert Banner</span>
                  </div>
                  <p>
                    High-confidence detections (like an unidentified person or car) trigger a persistent red alert banner across the top of the interface.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-white font-black uppercase tracking-tight flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>4. Live Feeds Grid</span>
                  </div>
                  <p>
                    Active events update camera status indicators and render bounding box overlays on the corresponding live camera canvas stream.
                  </p>
                </div>
              </div>
            </div>

            {/* Raw MQTT Packet Stream Terminal */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-white" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
                    Live MQTT Ingestion Stream Log ({recentPackets.length} Packets)
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Updates automatically</span>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 divide-y divide-slate-800 font-mono">
                {recentPackets.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 italic">
                    No MQTT packets in buffer. Click "Simulate Person Event" above or publish to <code className="text-slate-300">{mqttTopic}/events</code> on your broker.
                  </div>
                ) : (
                  recentPackets.map((pkt) => {
                    const isExpanded = expandedPacketId === pkt.id;
                    return (
                      <div key={pkt.id} className="py-2.5 text-xs font-mono">
                        <div
                          onClick={() => setExpandedPacketId(isExpanded ? null : pkt.id)}
                          className="flex items-center justify-between cursor-pointer hover:text-white text-slate-300 gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                            <span className="text-violet-400 font-black shrink-0">{pkt.topic}</span>
                            <span className="text-slate-400 truncate">{pkt.summary}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {new Date(pkt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        {isExpanded && (
                          <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-[11px] text-slate-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                            {typeof pkt.payload === 'object' ? JSON.stringify(pkt.payload, null, 2) : pkt.payload}
                          </pre>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Fast Broker Adjustments */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-md">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-white" />
                <span className="text-xs uppercase tracking-[0.2em] font-black text-white">
                  Quick Broker Connection Settings
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Broker Host / IP</label>
                  <input
                    type="text"
                    value={mqttHost}
                    onChange={(e) => setMqttHost(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Port</label>
                  <input
                    type="number"
                    value={mqttPort}
                    onChange={(e) => setMqttPort(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Topic Prefix</label>
                  <input
                    type="text"
                    value={mqttTopic}
                    onChange={(e) => setMqttTopic(e.target.value)}
                    placeholder="frigate"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Username (Optional)</label>
                  <input
                    type="text"
                    value={mqttUser}
                    onChange={(e) => setMqttUser(e.target.value)}
                    placeholder="mqtt_user"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Password (Optional)</label>
                  <input
                    type="password"
                    value={mqttPass}
                    onChange={(e) => setMqttPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-white transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleConnectMqttBroker}
                  disabled={isConnectingBroker || !mqttHost.trim()}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs uppercase tracking-wider font-black transition-colors disabled:opacity-40 shadow-md active:scale-95"
                >
                  {isConnectingBroker ? 'Connecting...' : 'Apply & Connect Broker'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800 text-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {activeServer?.isSimulated
              ? 'Status: Local High-Fidelity Simulation Active'
              : `Status: Connected to ${activeServer?.name}`}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-black uppercase tracking-wider text-xs transition-colors shadow-md active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
