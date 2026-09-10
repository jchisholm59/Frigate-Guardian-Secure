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
  Activity,
  Plus,
  Search,
} from 'lucide-react';
import { NotificationSettings, NotificationLog, BirdNetConfig, TidalStationConfig, TidalStation } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  gmail: {
    enabled: false,
    recipientEmail: '',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPassword: '',
    senderName: 'Frigate Guardian NVR',
  },
  slack: {
    enabled: false,
    webhookUrl: '',
    channel: '#frigate-alerts',
    username: 'Frigate Guardian NVR',
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
    stations: [],
    refreshIntervalMinutes: 60
  }
};

const TidalSettingsSection: React.FC<{ config?: TidalStationConfig; onUpdate: (partial: Partial<TidalStationConfig>) => void }> = ({ config, onUpdate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TidalStation[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const resp = await fetch(`/api/tides/stations/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await resp.json();
      if (data && data.success && Array.isArray(data.stations)) {
        setSearchResults(data.stations);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('[Tides] Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const currentStations = (config && Array.isArray(config.stations)) ? config.stations : [];

  const addStation = (station: any) => {
    if (!station || !station.id) return;
    if (currentStations.some(s => s && s.id === station.id)) return;

    // Normalize station data to ensure we have a 'name' property
    const normalizedStation: TidalStation = {
      id: station.id,
      code: station.code,
      name: station.officialName || station.name || 'Unknown Station',
      province: station.provinceCode || station.province || 'NS'
    };

    onUpdate({ stations: [...currentStations, normalizedStation] });
  };

  const removeStation = (id: string) => {
    if (!id) return;
    onUpdate({ stations: currentStations.filter(s => s && s.id !== id) });
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-md animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 font-bold text-xl flex items-center justify-center w-10 h-10">
            🌊
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight text-white">Tidal Intelligence Config</h4>
            <p className="text-xs text-slate-400">Add stations to track real-time water levels and tidal predictions.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Your Monitoring Sites</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {currentStations.map((s, idx) => {
            if (!s) return null;
            return (
              <div key={s.id || `station-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div>
                  <p className="text-xs font-black text-white uppercase">{s.name || s.officialName || 'Unknown Station'}</p>
                  <p className="text-[9px] font-mono text-cyan-500">{s.code || 'N/A'}</p>
                </div>
                <button
                  onClick={() => removeStation(s.id)}
                  className="px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all font-black text-[10px] border border-rose-500/20"
                >
                  DELETE
                </button>
              </div>
            );
          })}
          {currentStations.length === 0 && (
            <p className="text-[10px] text-slate-600 italic py-2">No stations added. Use the search below.</p>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-800">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Find Canadian Tidal Stations</h5>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search name or code (e.g. 'Halifax' or '00490')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-cyan-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-black uppercase tracking-widest hover:bg-cyan-500 disabled:opacity-50 min-w-[80px]"
          >
            {isSearching ? '...' : 'SEARCH'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {searchResults.map((s, idx) => {
              if (!s) return null;
              return (
                <div key={s.id || `result-${idx}`} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/40 hover:border-cyan-500/30 transition-all">
                  <div>
                    <p className="text-xs font-bold text-slate-200">{s.officialName || s.name}</p>
                    <p className="text-[9px] text-slate-500 font-mono">{s.code} • {s.provinceCode || s.province}</p>
                  </div>
                  <button
                    onClick={() => addStation(s)}
                    className="px-3 py-1 rounded-lg bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600 hover:text-white transition-all font-black text-[10px] border border-cyan-500/20"
                  >
                    ADD
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [activeChannelTab, setActiveChannelTab] = useState<'gmail' | 'slack' | 'discord' | 'birdnet' | 'tides' | 'filters' | 'logs'>('gmail');
  const [showSmtpAdvanced, setShowSmtpAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    channel: string;
    success: boolean;
    message: string;
  } | null>(null);

  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

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

  const updateTides = (partial: Partial<TidalStationConfig>) => {
    const currentTides = localSettings.tides || DEFAULT_NOTIFICATION_SETTINGS.tides!;
    const updated = {
      ...localSettings,
      tides: { ...currentTides, ...partial },
    };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

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
    { id: 'car', label: 'Car', icon: '🚗' },
    { id: 'truck', label: 'Truck / Van', icon: '🚚' },
    { id: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
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

  return (
    <div className="space-y-6">
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setActiveChannelTab('gmail'); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'gmail' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
            {localSettings.gmail.enabled && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>

          <button
            onClick={() => { setActiveChannelTab('slack'); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'slack' ? 'bg-[#4A154B] text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Slack</span>
            {localSettings.slack.enabled && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>

          <button
            onClick={() => { setActiveChannelTab('discord'); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'discord' ? 'bg-[#5865F2] text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Discord</span>
            {localSettings.discord.enabled && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>

          <button
            onClick={() => { setActiveChannelTab('birdnet'); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'birdnet' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            <Bird className="w-3.5 h-3.5" />
            <span>Birds</span>
            {localSettings.birdnet?.enabled && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>

          <button
            onClick={() => { setActiveChannelTab('tides'); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'tides' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Tides</span>
            {(localSettings.tides?.stations?.length || 0) > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>

          <button
            onClick={() => { setActiveChannelTab('filters'); setTestResult(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'filters' ? 'bg-white text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rules</span>
          </button>

          <button
            onClick={() => { setActiveChannelTab('logs'); setTestResult(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'logs' ? 'bg-white text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Logs</span>
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs transition-all shadow-md ${testResult.success ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-red-950/60 border-red-500/40 text-red-300'}`}>
          {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <div className="flex-1 font-bold">{testResult.message}</div>
          <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-white text-xs font-bold uppercase">Dismiss</button>
        </div>
      )}

      {activeChannelTab === 'gmail' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400"><Mail className="w-5 h-5" /></div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Gmail / Email Security Alerts</h4>
                <p className="text-xs text-slate-400">Sends formatted HTML surveillance alert emails.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={localSettings.gmail.enabled} onChange={(e) => updateGmail({ enabled: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">{localSettings.gmail.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Recipient Email Address(es) <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. security-alerts@example.com" value={localSettings.gmail.recipientEmail} onChange={(e) => updateGmail({ recipientEmail: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors" />
          </div>

          <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-4 space-y-3">
            <div onClick={() => setShowSmtpAdvanced(!showSmtpAdvanced)} className="flex items-center justify-between cursor-pointer text-xs text-slate-300 hover:text-white">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-red-400" />
                <span className="uppercase tracking-wider font-black">SMTP & App Password</span>
              </div>
              {showSmtpAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>

            {showSmtpAdvanced && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">SMTP Username</label>
                    <input type="text" value={localSettings.gmail.smtpUser || ''} onChange={(e) => updateGmail({ smtpUser: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">App Password</label>
                    <input type={showPassword ? 'text' : 'password'} value={localSettings.gmail.smtpPassword || ''} onChange={(e) => updateGmail({ smtpPassword: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 font-mono italic">Transmits alert via secure SMTP relay.</span>
            <button onClick={() => handleTestChannel('gmail')} disabled={testingChannel === 'gmail' || !localSettings.gmail.recipientEmail} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs uppercase font-black tracking-wider bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 shadow-md">
              {testingChannel === 'gmail' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{testingChannel === 'gmail' ? 'SENDING...' : 'TEST EMAIL'}</span>
            </button>
          </div>
        </div>
      )}

      {activeChannelTab === 'slack' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#4A154B]/60 border border-[#E01E5A]/30 text-emerald-400"><MessageSquare className="w-5 h-5" /></div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Slack Webhook Integration</h4>
                <p className="text-xs text-slate-400">Posts alerts directly into Slack.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={localSettings.slack.enabled} onChange={(e) => updateSlack({ enabled: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4A154B]"></div>
              <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">{localSettings.slack.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Webhook URL <span className="text-red-400">*</span></label>
            <input type="text" value={localSettings.slack.webhookUrl} onChange={(e) => updateSlack({ webhookUrl: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <button onClick={() => handleTestChannel('slack')} disabled={testingChannel === 'slack' || !localSettings.slack.webhookUrl} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs uppercase font-black tracking-wider bg-[#4A154B] hover:bg-[#611f64] text-white disabled:opacity-40 shadow-md">
            <Send className="w-3.5 h-3.5 text-emerald-300" />
            <span>TEST SLACK</span>
          </button>
        </div>
      )}

      {activeChannelTab === 'discord' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2]"><Bell className="w-5 h-5 text-white" /></div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Discord Webhooks</h4>
                <p className="text-xs text-slate-400">Sends rich embeds to Discord channels.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={localSettings.discord.enabled} onChange={(e) => updateDiscord({ enabled: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
              <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">{localSettings.discord.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
          <input type="text" placeholder="Webhook URL" value={localSettings.discord.webhookUrl} onChange={(e) => updateDiscord({ webhookUrl: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors" />
          <button onClick={() => handleTestChannel('discord')} disabled={testingChannel === 'discord' || !localSettings.discord.webhookUrl} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs uppercase font-black tracking-wider bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-md">
            <Send className="w-3.5 h-3.5" />
            <span>TEST DISCORD</span>
          </button>
        </div>
      )}

      {activeChannelTab === 'birdnet' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-400"><Bird className="w-5 h-5" /></div>
              <h4 className="text-sm font-black uppercase tracking-tight text-white">BirdNET-Go Integration</h4>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={localSettings.birdnet?.enabled} onChange={(e) => updateBirdnet({ enabled: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-2.5 text-xs font-black uppercase tracking-wider text-slate-300">{localSettings.birdnet?.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <input type="text" placeholder="Broker Host" value={localSettings.birdnet?.brokerHost || ''} onChange={(e) => updateBirdnet({ brokerHost: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white" />
             <input type="text" placeholder="BirdNET Web URL" value={localSettings.birdnet?.serverUrl || ''} onChange={(e) => updateBirdnet({ serverUrl: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white" />
             <input type="text" placeholder="Live Audio RTSP" value={localSettings.birdnet?.liveAudioUrl || ''} onChange={(e) => updateBirdnet({ liveAudioUrl: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white" />
             <input type="text" placeholder="Topic" value={localSettings.birdnet?.topic || ''} onChange={(e) => updateBirdnet({ topic: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white" />
          </div>
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-white uppercase tracking-tight">Daily Species Sentinel</p>
              <p className="text-[10px] text-amber-500 font-bold uppercase italic">Alert on first sighting of day</p>
            </div>
            <button onClick={() => updateBirdnet({ sendDailyAlerts: !localSettings.birdnet?.sendDailyAlerts })} className={`relative inline-flex h-5 w-10 rounded-full ${localSettings.birdnet?.sendDailyAlerts ? 'bg-amber-600' : 'bg-slate-700'}`}>
              <span className={`h-4 w-4 transform rounded-full bg-white transition ${localSettings.birdnet?.sendDailyAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      )}

      {activeChannelTab === 'tides' && (
        <TidalSettingsSection config={localSettings.tides} onUpdate={updateTides} />
      )}

      {activeChannelTab === 'filters' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
           <div className="pb-4 border-b border-slate-800">
             <h4 className="text-sm font-black uppercase tracking-tight text-white">Alert Rules</h4>
           </div>
           <div className="flex flex-wrap gap-2">
              {availableLabels.map((item) => {
                const isSelected = localSettings.filters.targetLabels?.includes(item.id);
                return (
                  <button key={item.id} onClick={() => toggleTargetLabel(item.id)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase border transition-all ${isSelected ? 'bg-white text-slate-950 border-white' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
                    <span>{item.icon}</span><span>{item.label}</span>
                  </button>
                );
              })}
           </div>
           <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-white">Ignore Parked Cars</h4>
                <p className="text-[10px] text-slate-400">Ignore stationary vehicles.</p>
              </div>
              <button onClick={() => updateFilters({ ignoreParkedCars: !localSettings.filters.ignoreParkedCars })} className={`relative inline-flex h-5 w-10 rounded-full ${localSettings.filters.ignoreParkedCars ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                <span className={`h-4 w-4 transform rounded-full bg-white transition ${localSettings.filters.ignoreParkedCars ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
           </div>
        </div>
      )}

      {activeChannelTab === 'logs' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h4 className="text-sm font-black uppercase tracking-tight text-white">Delivery Log</h4>
            <div className="flex gap-2">
              <button onClick={fetchLogs} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400"><RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} /></button>
              <button onClick={handleClearLogs} className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold uppercase">Clear</button>
            </div>
          </div>
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 font-mono">
            {logs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                <div className="flex gap-3">
                  <span className="text-blue-400 uppercase font-black text-[10px]">{log.channel}</span>
                  <div className="text-white font-bold">{log.message}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-emerald-400 uppercase font-black text-[10px]">{log.status}</div>
                  <div className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
