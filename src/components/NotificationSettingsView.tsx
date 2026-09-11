import React, { useState, useEffect } from 'react';
import {
  Mail,
  MessageSquare,
  Bell,
  CheckCircle2,
  AlertCircle,
  Send,
  Trash2,
  RefreshCw,
  Sliders,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
  Globe,
  Radio,
  Clock,
  Bird,
  Waves,
  Plus,
  Search,
  MapPin,
  X,
  Plane,
} from 'lucide-react';
import { NotificationSettings, NotificationLog, BirdNetConfig, TidalConfig, TidalStation, FlightsConfig } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  gmail: {
    enabled: false,
    recipientEmail: '',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPassword: '',
    senderName: 'WatchTower NVR',
  },
  slack: {
    enabled: false,
    webhookUrl: '',
    channel: '#frigate-alerts',
    username: 'WatchTower NVR',
    includeThumbnail: true,
  },
  discord: {
    enabled: false,
    webhookUrl: '',
    botUsername: 'Frigate AI Vision',
    avatarUrl: 'https://raw.githubusercontent.com/blakeblackshear/frigate/master/web/src/assets/frigate.png',
    includeThumbnail: true,
  },
  filters: {
    minImportance: 'all',
    minThreatLevel: 'medium_high',
    targetLabels: ['person', 'car', 'package'],
    selectedCameras: [],
    cooldownSeconds: 15,
    ignoreParkedCars: true,
  },
  birdnet: {
    enabled: false,
    brokerHost: '',
    port: 1883,
    topic: 'birdnet-sightings',
    username: '',
    password: ''
  },
  tides: {
    enabled: false,
    stations: [],
    units: 'm',
    refreshIntervalMinutes: 15,
    alerts: { enabled: false, channels: [], minutesBefore: 60, events: ['high', 'low'] },
  },
  flights: {
    enabled: false,
    piawareUrl: '',
    homeLat: 0,
    homeLon: 0,
  },
};

const DEFAULT_TIDES: TidalConfig = DEFAULT_NOTIFICATION_SETTINGS.tides!;
const MAX_TIDE_STATIONS = 4;
const DEFAULT_FLIGHTS: FlightsConfig = DEFAULT_NOTIFICATION_SETTINGS.flights!;

interface NotificationSettingsViewProps {
  settings: NotificationSettings;
  onUpdateSettings: (newSettings: NotificationSettings) => void;
  availableCameras?: { id: string; name: string }[];
}

export const NotificationSettingsView: React.FC<NotificationSettingsViewProps> = ({
  settings,
  onUpdateSettings,
  availableCameras = [],
}) => {
  const [localSettings, setLocalSettings] = useState<NotificationSettings>(settings);
  const [activeChannelTab, setActiveChannelTab] = useState<'gmail' | 'slack' | 'discord' | 'birdnet' | 'tides' | 'flights' | 'filters' | 'logs'>('gmail');
  const [showSmtpAdvanced, setShowSmtpAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Test dispatch status
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    channel: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Sync with prop when changed externally
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Load logs on mount and when logs tab is clicked
  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const resp = await fetch('/api/notifications/logs');
      if (resp.ok) {
        const data = await resp.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn('Could not fetch notification logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeChannelTab === 'logs') {
      fetchLogs();
    }
  }, [activeChannelTab]);

  const handleClearLogs = async () => {
    try {
      await fetch('/api/notifications/clear-logs', { method: 'POST' });
      setLogs([]);
    } catch (e) {
      console.warn('Error clearing logs:', e);
    }
  };

  // Helper to update specific nested section
  const updateGmail = (partial: Partial<NotificationSettings['gmail']>) => {
    const updated = {
      ...localSettings,
      gmail: { ...localSettings.gmail, ...partial },
    };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateSlack = (partial: Partial<NotificationSettings['slack']>) => {
    const updated = {
      ...localSettings,
      slack: { ...localSettings.slack, ...partial },
    };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateDiscord = (partial: Partial<NotificationSettings['discord']>) => {
    const updated = {
      ...localSettings,
      discord: { ...localSettings.discord, ...partial },
    };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateFilters = (partial: Partial<NotificationSettings['filters']>) => {
    const updated = {
      ...localSettings,
      filters: { ...localSettings.filters, ...partial },
    };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateBirdnet = (partial: Partial<BirdNetConfig>) => {
    const updated = {
      ...localSettings,
      birdnet: { ...(localSettings.birdnet || DEFAULT_NOTIFICATION_SETTINGS.birdnet!), ...partial },
    };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const tides: TidalConfig = { ...DEFAULT_TIDES, ...(localSettings.tides || {}), alerts: { ...DEFAULT_TIDES.alerts, ...(localSettings.tides?.alerts || {}) } };

  const updateTides = (partial: Partial<TidalConfig>) => {
    const updated = { ...localSettings, tides: { ...tides, ...partial } };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateTideAlerts = (partial: Partial<TidalConfig['alerts']>) => {
    updateTides({ alerts: { ...tides.alerts, ...partial } });
  };

  const flights: FlightsConfig = { ...DEFAULT_FLIGHTS, ...(localSettings.flights || {}) };

  const updateFlights = (partial: Partial<FlightsConfig>) => {
    const updated = { ...localSettings, flights: { ...flights, ...partial } };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  // Flight receiver connection test
  const [isTestingFlights, setIsTestingFlights] = useState(false);
  const [flightsTestResult, setFlightsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestFlights = async () => {
    if (!flights.piawareUrl.trim()) return;
    setIsTestingFlights(true);
    setFlightsTestResult(null);
    try {
      const resp = await fetch('/api/flights/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piawareUrl: flights.piawareUrl.trim() }),
      });
      const data = await resp.json();
      if (data.success) {
        setFlightsTestResult({
          success: true,
          message: `Connected to ${data.resolvedUrl} — ${data.aircraftCount} aircraft currently reporting.`,
        });
      } else {
        setFlightsTestResult({
          success: false,
          message: `${data.error || 'Could not reach that address.'}${data.resolvedUrl ? ` (tried ${data.resolvedUrl})` : ''}`,
        });
      }
    } catch {
      setFlightsTestResult({ success: false, message: 'Network error reaching the server.' });
    } finally {
      setIsTestingFlights(false);
    }
  };

  // Tide station search
  const [tideQuery, setTideQuery] = useState('');
  const [tideResults, setTideResults] = useState<TidalStation[]>([]);
  const [tideSearching, setTideSearching] = useState(false);
  const [tideSearchError, setTideSearchError] = useState<string | null>(null);

  const searchTideStations = async () => {
    if (!tideQuery.trim()) return;
    setTideSearching(true);
    setTideSearchError(null);
    try {
      const resp = await fetch(`/api/tides/stations/search?q=${encodeURIComponent(tideQuery.trim())}`);
      const data = await resp.json();
      if (data.success) setTideResults(data.stations || []);
      else setTideSearchError(data.error || 'Search failed');
    } catch {
      setTideSearchError('Network error during station search');
    } finally {
      setTideSearching(false);
    }
  };

  const addTideStation = (s: TidalStation) => {
    if (tides.stations.some((x) => x.id === s.id) || tides.stations.length >= MAX_TIDE_STATIONS) return;
    updateTides({ stations: [...tides.stations, s] });
    setTideResults([]);
    setTideQuery('');
  };

  const removeTideStation = (id: string) => {
    updateTides({ stations: tides.stations.filter((x) => x.id !== id) });
  };

  const toggleTideAlertChannel = (ch: 'gmail' | 'slack' | 'discord') => {
    const set = new Set(tides.alerts.channels);
    set.has(ch) ? set.delete(ch) : set.add(ch);
    updateTideAlerts({ channels: Array.from(set) as ('gmail' | 'slack' | 'discord')[] });
  };

  const toggleTideEvent = (ev: 'high' | 'low') => {
    const set = new Set(tides.alerts.events);
    set.has(ev) ? set.delete(ev) : set.add(ev);
    updateTideAlerts({ events: Array.from(set) as ('high' | 'low')[] });
  };

  // Send a test notification
  const handleTestChannel = async (channel: 'gmail' | 'slack' | 'discord') => {
    setTestingChannel(channel);
    setTestResult(null);

    const config =
      channel === 'gmail'
        ? localSettings.gmail
        : channel === 'slack'
        ? localSettings.slack
        : localSettings.discord;

    try {
      const resp = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          config,
          sampleEvent: {
            id: `test-${Date.now()}`,
            camera: availableCameras[0]?.id || 'front_porch',
            label: 'person',
            score: 0.96,
            startTime: Date.now(),
            duration: 8,
            zones: ['doorstep_package_zone'],
            importance: 'alert',
            threatLevel: 'high',
            summary: `Manual Test Trigger: Verified courier identified on ${availableCameras[0]?.name || 'Front Porch'}.`,
            recommendedAction: 'Security test verified successfully.',
          },
        }),
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        setTestResult({
          channel,
          success: true,
          message:
            data.result?.message ||
            `Test alert successfully dispatched to ${channel.toUpperCase()}!`,
        });
        fetchLogs();
      } else {
        setTestResult({
          channel,
          success: false,
          message: data.error || `Failed to dispatch test notification to ${channel}.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        channel,
        success: false,
        message: err.message || 'Network error while contacting notification API.',
      });
    } finally {
      setTestingChannel(null);
    }
  };

  const availableLabels = [
    { id: 'person', label: 'Person', icon: '👤' },
    { id: 'car', label: 'Vehicle / Car', icon: '🚗' },
    { id: 'package', label: 'Package', icon: '📦' },
    { id: 'dog', label: 'Dog', icon: '🐕' },
    { id: 'cat', label: 'Cat', icon: '🐈' },
    { id: 'bicycle', label: 'Bicycle', icon: '🚲' },
  ];

  const toggleTargetLabel = (labelId: string) => {
    const current = localSettings.filters.targetLabels || [];
    const updated = current.includes(labelId)
      ? current.filter((l) => l !== labelId)
      : [...current, labelId];
    updateFilters({ targetLabels: updated });
  };

  // selectedCameras is an allow-list: empty means "notify for every camera".
  // Toggling a camera off when the list is currently empty seeds it with
  // every OTHER known camera, so that one camera becomes the only one muted
  // instead of jumping straight to "only this camera notifies".
  const toggleSelectedCamera = (cameraId: string) => {
    const current = localSettings.filters.selectedCameras && localSettings.filters.selectedCameras.length > 0
      ? localSettings.filters.selectedCameras
      : availableCameras.map((c) => c.id);
    const updated = current.includes(cameraId)
      ? current.filter((c) => c !== cameraId)
      : [...current, cameraId];
    updateFilters({ selectedCameras: updated });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Channel Switcher */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          {/* Gmail Tab */}
          <button
            id="tab-notif-gmail"
            onClick={() => {
              setActiveChannelTab('gmail');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${
              activeChannelTab === 'gmail'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-white" />
            <span>Gmail / Email</span>
            {localSettings.gmail.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Slack Tab */}
          <button
            id="tab-notif-slack"
            onClick={() => {
              setActiveChannelTab('slack');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${
              activeChannelTab === 'slack'
                ? 'bg-[#4A154B] text-white shadow-md border border-[#E01E5A]/50'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Slack</span>
            {localSettings.slack.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Discord Tab */}
          <button
            id="tab-notif-discord"
            onClick={() => {
              setActiveChannelTab('discord');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${
              activeChannelTab === 'discord'
                ? 'bg-[#5865F2] text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-white" />
            <span>Discord</span>
            {localSettings.discord.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* BirdNET Tab */}
          <button
            id="tab-notif-birdnet"
            onClick={() => {
              setActiveChannelTab('birdnet');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${
              activeChannelTab === 'birdnet'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Bird className="w-3.5 h-3.5 text-white" />
            <span>BirdNET-Go</span>
            {localSettings.birdnet?.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Tides Tab */}
          <button
            id="tab-notif-tides"
            onClick={() => {
              setActiveChannelTab('tides');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${
              activeChannelTab === 'tides'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-white" />
            <span>Tides</span>
            {localSettings.tides?.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Flights Tab */}
          <button
            id="tab-notif-flights"
            onClick={() => {
              setActiveChannelTab('flights');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${
              activeChannelTab === 'flights'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Plane className="w-3.5 h-3.5 text-white" />
            <span>Flights</span>
            {localSettings.flights?.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Filter Rules Tab */}
          <button
            id="tab-notif-filters"
            onClick={() => {
              setActiveChannelTab('filters');
              setTestResult(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${
              activeChannelTab === 'filters'
                ? 'bg-white text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Alert Rules</span>
          </button>

          {/* Audit Logs Tab */}
          <button
            id="tab-notif-logs"
            onClick={() => {
              setActiveChannelTab('logs');
              setTestResult(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${
              activeChannelTab === 'logs'
                ? 'bg-white text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Delivery Log ({logs.length})</span>
          </button>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="text-slate-500 uppercase font-bold">Active Channels:</span>
          <span className="text-white font-black">
            {[
              localSettings.gmail.enabled ? 'Gmail' : null,
              localSettings.slack.enabled ? 'Slack' : null,
              localSettings.discord.enabled ? 'Discord' : null,
            ]
              .filter(Boolean)
              .join(' • ') || 'None (Disabled)'}
          </span>
        </div>
      </div>

      {/* Test feedback toast */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs transition-all shadow-md ${
            testResult.success
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/60 border-red-500/40 text-red-300'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-black uppercase tracking-wider">
              {testResult.success ? 'Dispatch Success' : 'Dispatch Error'}:
            </span>{' '}
            {testResult.message}
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-slate-400 hover:text-white text-xs font-bold uppercase"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* -------------------- GMAIL / EMAIL TAB -------------------- */}
      {activeChannelTab === 'gmail' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          {/* Header & Enable Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Gmail / Email Security Alerts</h4>
                <p className="text-xs text-slate-400">
                  Sends formatted HTML surveillance alert emails with detection score and threat level.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-gmail-enabled"
                  type="checkbox"
                  checked={localSettings.gmail.enabled}
                  onChange={(e) => updateGmail({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">
                  {localSettings.gmail.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          {/* Recipient Address */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Recipient Email Address(es) <span className="text-red-400">*</span>
            </label>
            <input
              id="input-gmail-recipients"
              type="text"
              placeholder="e.g. security-alerts@example.com, home@example.com"
              value={localSettings.gmail.recipientEmail}
              onChange={(e) => updateGmail({ recipientEmail: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-white transition-colors"
            />
            <p className="text-xs text-slate-500">
              Separate multiple recipients with commas. Verified upon dispatch.
            </p>
          </div>

          {/* Collapsible SMTP / App Password Options */}
          <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-4 space-y-3">
            <div
              onClick={() => setShowSmtpAdvanced(!showSmtpAdvanced)}
              className="flex items-center justify-between cursor-pointer text-xs text-slate-300 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-red-400" />
                <span className="uppercase tracking-wider font-black">
                  SMTP & Google App Password Configuration
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-bold">
                  {localSettings.gmail.smtpUser ? 'Configured' : 'Optional (Uses Simulation Mode)'}
                </span>
              </div>
              {showSmtpAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>

            {showSmtpAdvanced && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p className="font-black text-white uppercase tracking-tight">How to use with Gmail:</p>
                  <p>
                    1. Go to your Google Account &rarr; Security &rarr; 2-Step Verification &rarr; <strong>App passwords</strong>.
                  </p>
                  <p>2. Create an App password named &quot;WatchTower&quot; and paste the 16-character code below.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Gmail / SMTP Username</label>
                    <input
                      id="input-gmail-smtp-user"
                      type="text"
                      placeholder="your.email@gmail.com"
                      value={localSettings.gmail.smtpUser || ''}
                      onChange={(e) => updateGmail({ smtpUser: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold text-slate-400">App Password / Secret</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[10px] text-slate-400 hover:text-white uppercase font-bold"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      id="input-gmail-smtp-pass"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="16-character app password"
                      value={localSettings.gmail.smtpPassword || ''}
                      onChange={(e) => updateGmail({ smtpPassword: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">SMTP Host</label>
                    <input
                      type="text"
                      placeholder="smtp.gmail.com"
                      value={localSettings.gmail.smtpHost || 'smtp.gmail.com'}
                      onChange={(e) => updateGmail({ smtpHost: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Port (465 SSL / 587 TLS)</label>
                    <input
                      type="number"
                      placeholder="465"
                      value={localSettings.gmail.smtpPort || 465}
                      onChange={(e) => updateGmail({ smtpPort: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Sender Display Name</label>
                    <input
                      type="text"
                      placeholder="WatchTower NVR"
                      value={localSettings.gmail.senderName || 'WatchTower NVR'}
                      onChange={(e) => updateGmail({ senderName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Test Dispatch Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-mono">
              Validates recipient, parses security template, and transmits alert.
            </span>
            <button
              id="btn-test-gmail"
              onClick={() => handleTestChannel('gmail')}
              disabled={testingChannel === 'gmail' || !localSettings.gmail.recipientEmail}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs uppercase font-black tracking-wider bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-95"
            >
              {testingChannel === 'gmail' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{testingChannel === 'gmail' ? 'Transmitting...' : 'Send Test Email'}</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------- SLACK TAB -------------------- */}
      {activeChannelTab === 'slack' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          {/* Header & Enable Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#4A154B]/60 border border-[#E01E5A]/30 text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Slack Incoming Webhook Integration</h4>
                <p className="text-xs text-slate-400">
                  Posts structured Block Kit security alerts directly into your Slack team channel.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-slack-enabled"
                  type="checkbox"
                  checked={localSettings.slack.enabled}
                  onChange={(e) => updateSlack({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4A154B]"></div>
                <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">
                  {localSettings.slack.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Slack Incoming Webhook URL <span className="text-red-400">*</span>
              </label>
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
              >
                <span>Slack Webhook Docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              id="input-slack-webhook"
              type="text"
              placeholder="https://hooks.slack.com/services/your-webhook-url-here"
              value={localSettings.slack.webhookUrl}
              onChange={(e) => updateSlack({ webhookUrl: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Channel Name & Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Target Channel (Optional)</label>
              <input
                type="text"
                placeholder="#security-alerts"
                value={localSettings.slack.channel || ''}
                onChange={(e) => updateSlack({ channel: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Bot Display Name</label>
              <input
                type="text"
                placeholder="WatchTower NVR"
                value={localSettings.slack.username || ''}
                onChange={(e) => updateSlack({ username: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          {/* Test Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-mono">
              Sends an interactive Block Kit event card with camera detection data.
            </span>
            <button
              id="btn-test-slack"
              onClick={() => handleTestChannel('slack')}
              disabled={testingChannel === 'slack' || !localSettings.slack.webhookUrl}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs uppercase font-black tracking-wider bg-[#4A154B] hover:bg-[#611f64] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-[#E01E5A]/40 shadow-md active:scale-95"
            >
              {testingChannel === 'slack' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-emerald-300" />
              )}
              <span>{testingChannel === 'slack' ? 'Posting to Slack...' : 'Send Test Alert'}</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------- DISCORD TAB -------------------- */}
      {activeChannelTab === 'discord' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          {/* Header & Enable Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2]">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Discord Webhook Notifications</h4>
                <p className="text-xs text-slate-400">
                  Sends Rich Color-Coded Embeds with camera snapshots, threat metrics, and zone tags.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-discord-enabled"
                  type="checkbox"
                  checked={localSettings.discord.enabled}
                  onChange={(e) => updateDiscord({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">
                  {localSettings.discord.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Discord Webhook URL <span className="text-red-400">*</span>
              </label>
              <a
                href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
              >
                <span>Discord Webhook Setup Guide</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              id="input-discord-webhook"
              type="text"
              placeholder="https://discord.com/api/webhooks/1234567890/abcdefg..."
              value={localSettings.discord.webhookUrl}
              onChange={(e) => updateDiscord({ webhookUrl: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Bot Username & Avatar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Bot Display Name</label>
              <input
                type="text"
                placeholder="Frigate AI Vision"
                value={localSettings.discord.botUsername || ''}
                onChange={(e) => updateDiscord({ botUsername: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Custom Avatar Icon URL</label>
              <input
                type="text"
                placeholder="https://.../avatar.png"
                value={localSettings.discord.avatarUrl || ''}
                onChange={(e) => updateDiscord({ avatarUrl: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          {/* Test Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-mono">
              Emits a high-contrast Discord Rich Embed with alert level and detection stats.
            </span>
            <button
              id="btn-test-discord"
              onClick={() => handleTestChannel('discord')}
              disabled={testingChannel === 'discord' || !localSettings.discord.webhookUrl}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs uppercase font-black tracking-wider bg-[#5865F2] hover:bg-[#4752C4] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-95"
            >
              {testingChannel === 'discord' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{testingChannel === 'discord' ? 'Posting to Discord...' : 'Send Test Alert'}</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------- BIRDNET-GO TAB -------------------- */}
      {activeChannelTab === 'birdnet' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          {/* Header & Enable Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-400">
                <Bird className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">BirdNET-Go Integration</h4>
                <p className="text-xs text-slate-400">
                  Connect to your BirdNET-Go instance via MQTT to track bird sightings in your yard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-birdnet-enabled"
                  type="checkbox"
                  checked={localSettings.birdnet?.enabled}
                  onChange={(e) => updateBirdnet({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">
                  {localSettings.birdnet?.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">MQTT Broker Host</label>
              <input
                type="text"
                placeholder="192.168.1.xxx"
                value={localSettings.birdnet?.brokerHost || ''}
                onChange={(e) => updateBirdnet({ brokerHost: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">BirdNET-Go Web URL</label>
              <input
                type="text"
                placeholder="http://192.168.1.xxx:8080"
                value={localSettings.birdnet?.serverUrl || ''}
                onChange={(e) => updateBirdnet({ serverUrl: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-700 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 italic mt-1">Required for audio clip playback (e.g. http://192.168.2.210:8080)</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Audio RTSP URL</label>
              <input
                type="text"
                placeholder="rtsp://192.168.1.xxx:554/live"
                value={localSettings.birdnet?.liveAudioUrl || ''}
                onChange={(e) => updateBirdnet({ liveAudioUrl: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-700 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 italic mt-1">Direct RTSP feed from your ESP32 audio server.</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">MQTT Port</label>
              <input
                type="number"
                placeholder="1883"
                value={localSettings.birdnet?.port || 1883}
                onChange={(e) => updateBirdnet({ port: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">MQTT Topic</label>
              <input
                type="text"
                placeholder="birdnet-sightings"
                value={localSettings.birdnet?.topic || 'birdnet-sightings'}
                onChange={(e) => updateBirdnet({ topic: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2 p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-600/20">
                    <Bell className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Daily Species Sentinel</h4>
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-tight">Alert on first discovery of each day</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateBirdnet({ sendDailyAlerts: !localSettings.birdnet?.sendDailyAlerts })}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    localSettings.birdnet?.sendDailyAlerts ? 'bg-amber-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localSettings.birdnet?.sendDailyAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">MQTT Username (Optional)</label>
              <input
                type="text"
                placeholder="None"
                value={localSettings.birdnet?.username || ''}
                onChange={(e) => updateBirdnet({ username: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">MQTT Password (Optional)</label>
              <input
                type="password"
                placeholder="None"
                value={localSettings.birdnet?.password || ''}
                onChange={(e) => updateBirdnet({ password: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-900/10 border border-blue-500/20 text-xs text-blue-300">
            <p className="font-bold mb-1">Cottage Compatibility Mode:</p>
            <p className="opacity-80 leading-relaxed">
              If your cottage uses a different MQTT broker, you can specify its unique IP and credentials here.
              The sightings will be synced to this dashboard in real-time.
            </p>
          </div>
        </div>
      )}

      {/* -------------------- TIDES TAB -------------------- */}
      {activeChannelTab === 'tides' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          {/* Header & Enable Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                <Waves className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Tide Predictions &amp; Alerts</h4>
                <p className="text-xs text-slate-400">
                  Canadian Hydrographic Service (DFO) predictions for up to {MAX_TIDE_STATIONS} stations, shown on the Tides tab.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="toggle-tides-enabled"
                type="checkbox"
                checked={tides.enabled}
                onChange={(e) => updateTides({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">
                {tides.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {/* Configured stations */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Monitored Stations ({tides.stations.length}/{MAX_TIDE_STATIONS})
            </label>
            {tides.stations.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No stations added yet — search below.</p>
            ) : (
              <div className="space-y-2">
                {tides.stations.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">{s.name}</p>
                        <p className="text-[10px] font-mono text-slate-500">
                          #{s.code} · {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeTideStation(s.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      title="Remove station"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Station search */}
          {tides.stations.length < MAX_TIDE_STATIONS && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search CHS stations (e.g. Halifax, Digby, 00490)"
                  value={tideQuery}
                  onChange={(e) => setTideQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchTideStations()}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={searchTideStations}
                  disabled={tideSearching || !tideQuery.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  {tideSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Search</span>
                </button>
              </div>
              {tideSearchError && <p className="text-[11px] text-red-400 font-bold">{tideSearchError}</p>}
              {tideResults.length > 0 && (
                <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-800 rounded-xl p-2 bg-slate-900/50">
                  {tideResults.map((s) => {
                    const added = tides.stations.some((x) => x.id === s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800/60">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{s.name}</p>
                          <p className="text-[10px] font-mono text-slate-500">#{s.code}</p>
                        </div>
                        <button
                          onClick={() => addTideStation(s)}
                          disabled={added}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-600 disabled:opacity-40 disabled:hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{added ? 'Added' : 'Add'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Units */}
          <div className="flex items-center justify-between pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Display Units</label>
            <div className="flex rounded-xl overflow-hidden border border-slate-800">
              {(['m', 'ft'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => updateTides({ units: u })}
                  className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-colors ${
                    tides.units === u ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {u === 'm' ? 'Metres' : 'Feet'}
                </button>
              ))}
            </div>
          </div>

          {/* Tide alerts */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">High / Low Tide Alerts</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tides.alerts.enabled}
                  onChange={(e) => updateTideAlerts({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {tides.alerts.enabled && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-300">Notify</label>
                  <input
                    type="number"
                    min={5}
                    max={360}
                    step={5}
                    value={tides.alerts.minutesBefore}
                    onChange={(e) => updateTideAlerts({ minutesBefore: Math.max(5, Number(e.target.value) || 60) })}
                    className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <label className="text-xs font-bold text-slate-300">minutes before each event</label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['high', 'low'] as const).map((ev) => (
                    <button
                      key={ev}
                      onClick={() => toggleTideEvent(ev)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors ${
                        tides.alerts.events.includes(ev)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {ev} tide
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deliver via</p>
                  <div className="flex flex-wrap gap-2">
                    {(['gmail', 'slack', 'discord'] as const).map((ch) => (
                      <button
                        key={ch}
                        onClick={() => toggleTideAlertChannel(ch)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors ${
                          tides.alerts.channels.includes(ch)
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-white'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed pt-1">
                    Tide alerts reuse the webhook URL / SMTP credentials from the Gmail, Slack and Discord tabs — the
                    channel doesn&apos;t need to be &quot;enabled&quot; there, just configured.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-cyan-900/10 border border-cyan-500/20 text-xs text-cyan-300">
            <p className="opacity-80 leading-relaxed">
              Data: <span className="font-mono">api-iwls.dfo-mpo.gc.ca</span> — official CHS water-level predictions.
              Predictions are cached for 10 minutes. Sunrise/sunset and moon phase are computed locally from each
              station&apos;s coordinates.
            </p>
          </div>
        </div>
      )}

      {/* -------------------- FLIGHTS TAB -------------------- */}
      {activeChannelTab === 'flights' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          {/* Header & Enable Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Live Air Traffic (ADS-B)</h4>
                <p className="text-xs text-slate-400">
                  Connect a local PiAware / dump1090-fa receiver to show live aircraft on a map centered on your home.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-flights-enabled"
                  type="checkbox"
                  checked={flights.enabled}
                  onChange={(e) => updateFlights({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">
                  {flights.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">PiAware Receiver Address</label>
            <input
              type="text"
              placeholder="192.168.1.xxx"
              value={flights.piawareUrl}
              onChange={(e) => updateFlights({ piawareUrl: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-700 focus:outline-none focus:border-amber-500"
            />
            <p className="text-[10px] text-slate-600">
              Just the IP address — WatchTower fills in the rest (<code>/skyaware/data/aircraft.json</code>). A full URL
              also works if your install uses a different path.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Home Latitude</label>
              <input
                type="number"
                step="0.00001"
                placeholder="44.65369"
                value={flights.homeLat || ''}
                onChange={(e) => updateFlights({ homeLat: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-700 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Home Longitude</label>
              <input
                type="number"
                step="0.00001"
                placeholder="-63.81416"
                value={flights.homeLon || ''}
                onChange={(e) => updateFlights({ homeLon: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-700 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {flightsTestResult && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                flightsTestResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              {flightsTestResult.message}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-mono">
              Origin/destination and aircraft photos come from free community APIs (adsbdb.com, planespotters.net).
            </span>
            <button
              onClick={handleTestFlights}
              disabled={isTestingFlights || !flights.piawareUrl.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs uppercase font-black tracking-wider bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-95"
            >
              {isTestingFlights ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
              <span>{isTestingFlights ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------- ALERT RULES & FILTERS TAB -------------------- */}
      {activeChannelTab === 'filters' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="pb-4 border-b border-slate-800">
            <h4 className="text-sm font-black uppercase tracking-tight text-white">Event Notification Trigger Rules</h4>
            <p className="text-xs text-slate-400">
              Control which detected events trigger dispatches to Gmail, Slack, and Discord.
            </p>
          </div>

          {/* Minimum Threat Level */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Minimum Threat Level Filter
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => updateFilters({ minThreatLevel: 'all' })}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  localSettings.filters.minThreatLevel === 'all'
                    ? 'bg-slate-900 border-white text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wider">ALL THREAT LEVELS</div>
                <div className="text-xs text-slate-500 mt-1">Low, Medium, and High events trigger alerts</div>
              </button>

              <button
                type="button"
                onClick={() => updateFilters({ minThreatLevel: 'medium_high' })}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  localSettings.filters.minThreatLevel === 'medium_high'
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wider text-amber-400">MEDIUM & HIGH ONLY</div>
                <div className="text-xs text-slate-500 mt-1">Recommended: Ignores low confidence/routine events</div>
              </button>

              <button
                type="button"
                onClick={() => updateFilters({ minThreatLevel: 'high_only' })}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  localSettings.filters.minThreatLevel === 'high_only'
                    ? 'bg-red-950/40 border-red-500/60 text-red-200 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wider text-red-400">CRITICAL / HIGH ONLY</div>
                <div className="text-xs text-slate-500 mt-1">Only verified security intrusions & alerts</div>
              </button>
            </div>
          </div>

          {/* Importance Filter */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Frigate Event Classification
            </label>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => updateFilters({ minImportance: 'all' })}
                className={`px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider border transition-all ${
                  localSettings.filters.minImportance === 'all'
                    ? 'bg-white text-slate-950 border-white shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                All Detections
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ minImportance: 'alert_only' })}
                className={`px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider border transition-all ${
                  localSettings.filters.minImportance === 'alert_only'
                    ? 'bg-red-600 text-white border-red-600 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Alerts & Review Only
              </button>
            </div>
          </div>

          {/* Target Object Labels */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Target Object Labels ({localSettings.filters.targetLabels?.length || 0} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableLabels.map((item) => {
                const isSelected = localSettings.filters.targetLabels?.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleTargetLabel(item.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                      isSelected
                        ? 'bg-white text-slate-950 border-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="text-[10px] ml-1">{isSelected ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              Only events containing at least one selected target label will trigger notifications.
            </p>
          </div>

          {/* Per-Camera Notifications */}
          {availableCameras.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Camera Notifications
                </label>
                {localSettings.filters.selectedCameras && localSettings.filters.selectedCameras.length > 0 && (
                  <button
                    type="button"
                    onClick={() => updateFilters({ selectedCameras: [] })}
                    className="text-[10px] uppercase font-bold tracking-wider text-slate-500 hover:text-white"
                  >
                    Enable All
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableCameras.map((cam) => {
                  const isEnabled = !localSettings.filters.selectedCameras
                    || localSettings.filters.selectedCameras.length === 0
                    || localSettings.filters.selectedCameras.includes(cam.id);
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => toggleSelectedCamera(cam.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                        isEnabled
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'
                      }`}
                      title={isEnabled ? 'Notifications enabled — click to mute this camera' : 'Notifications muted — click to enable'}
                    >
                      <span>{cam.name}</span>
                      <span className="text-[10px] ml-1">{isEnabled ? '🔔' : '🔕'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                Muted cameras are excluded from Gmail/Slack/Discord notifications, but still record and appear in Review.
              </p>
            </div>
          )}

          {/* Cooldown Timer */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Notification Cooldown Prevention
            </label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              {[
                { sec: 0, label: 'No Delay' },
                { sec: 15, label: '15 seconds' },
                { sec: 30, label: '30 seconds' },
                { sec: 60, label: '1 minute' },
              ].map((c) => (
                <button
                  key={c.sec}
                  type="button"
                  onClick={() => updateFilters({ cooldownSeconds: c.sec })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    localSettings.filters.cooldownSeconds === c.sec
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Prevents duplicate notification spam during continuous camera tracking events.
            </p>
          </div>

          {/* AI Intelligence: Parked Car Logic */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-950 flex items-center justify-center border border-emerald-500/30">
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Intelligent Parked Car Filtering</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Ignore cars that Frigate flags as stationary.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateFilters({ ignoreParkedCars: !localSettings.filters.ignoreParkedCars })}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  localSettings.filters.ignoreParkedCars ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.filters.ignoreParkedCars ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- DELIVERY LOGS TAB -------------------- */}
      {activeChannelTab === 'logs' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h4 className="text-sm font-black uppercase tracking-tight text-white">Live Notification Delivery Logs</h4>
              <p className="text-xs text-slate-400">
                Audit trail of events dispatched to Gmail, Slack, and Discord.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchLogs}
                disabled={isLoadingLogs}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Refresh logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleClearLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 text-xs font-bold uppercase transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 font-mono text-xs">
              No notifications dispatched yet. Try sending a test alert or trigger an event.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 font-mono">
              {logs.map((log) => {
                const channelColor =
                  log.channel === 'gmail'
                    ? 'text-red-400 border-red-500/30 bg-red-950/30'
                    : log.channel === 'slack'
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30'
                    : 'text-indigo-400 border-indigo-500/30 bg-indigo-950/30';

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded-lg border uppercase text-[10px] font-black tracking-wider ${channelColor}`}>
                        {log.channel}
                      </span>
                      <div>
                        <div className="text-white font-bold">
                          {log.message}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <span>Camera: <strong className="text-slate-200">{log.camera}</strong></span>
                          <span>•</span>
                          <span>Object: <strong className="text-slate-200">{log.label}</strong></span>
                          {log.details && (
                            <>
                              <span>•</span>
                              <span>{log.details}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs uppercase font-black tracking-wider ${
                          log.status === 'sent'
                            ? 'text-emerald-400'
                            : log.status === 'simulated'
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {log.status}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
