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
} from 'lucide-react';
import { NotificationSettings, NotificationLog, BirdNetConfig } from '../types';

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
  }
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
  const [activeChannelTab, setActiveChannelTab] = useState<'gmail' | 'slack' | 'discord' | 'birdnet' | 'filters' | 'logs'>('gmail');
  const [showSmtpAdvanced, setShowSmtpAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ channel: string; success: boolean; message: string; } | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateGmail = (partial: Partial<NotificationSettings['gmail']>) => {
    const updated = { ...localSettings, gmail: { ...localSettings.gmail, ...partial } };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateSlack = (partial: Partial<NotificationSettings['slack']>) => {
    const updated = { ...localSettings, slack: { ...localSettings.slack, ...partial } };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateDiscord = (partial: Partial<NotificationSettings['discord']>) => {
    const updated = { ...localSettings, discord: { ...localSettings.discord, ...partial } };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateFilters = (partial: Partial<NotificationSettings['filters']>) => {
    const updated = { ...localSettings, filters: { ...localSettings.filters, ...partial } };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const updateBirdnet = (partial: Partial<BirdNetConfig>) => {
    const updated = { ...localSettings, birdnet: { ...(localSettings.birdnet || DEFAULT_NOTIFICATION_SETTINGS.birdnet!), ...partial } };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const handleTestChannel = async (channel: 'gmail' | 'slack' | 'discord') => {
    setTestingChannel(channel);
    setTestResult(null);
    try {
      const resp = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, settings: localSettings }),
      });
      const data = await resp.json();
      if (data.success) setTestResult({ channel, success: true, message: 'Success' });
      else setTestResult({ channel, success: false, message: 'Failed' });
    } catch (e) {
      setTestResult({ channel, success: false, message: 'Error' });
    } finally {
      setTestingChannel(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setActiveChannelTab('gmail')} className={`px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'gmail' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Email</button>
          <button onClick={() => setActiveChannelTab('slack')} className={`px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'slack' ? 'bg-[#4A154B] text-white' : 'bg-slate-900 text-slate-400'}`}>Slack</button>
          <button onClick={() => setActiveChannelTab('discord')} className={`px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'discord' ? 'bg-[#5865F2] text-white' : 'bg-slate-900 text-slate-400'}`}>Discord</button>
          <button onClick={() => setActiveChannelTab('birdnet')} className={`px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'birdnet' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Birds</button>
          <button onClick={() => setActiveChannelTab('filters')} className={`px-4 py-2 rounded-xl text-xs uppercase font-black tracking-wider transition-all ${activeChannelTab === 'filters' ? 'bg-white text-slate-950' : 'bg-slate-900 text-slate-400'}`}>Rules</button>
        </div>
      </div>

      {activeChannelTab === 'gmail' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <h4 className="text-sm font-black uppercase tracking-tight text-white">Gmail Settings</h4>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={localSettings.gmail.enabled} onChange={(e) => updateGmail({ enabled: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:bg-red-600"></div>
            </label>
          </div>
          <input type="text" placeholder="Recipient Email" value={localSettings.gmail.recipientEmail} onChange={(e) => updateGmail({ recipientEmail: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white" />
          <button onClick={() => handleTestChannel('gmail')} className="w-full py-2.5 rounded-xl bg-red-600 text-white font-black text-xs uppercase shadow-md">Test Dispatch</button>
        </div>
      )}

      {activeChannelTab === 'slack' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h4 className="text-sm font-black uppercase tracking-tight text-white">Slack Settings</h4>
            <input type="checkbox" checked={localSettings.slack.enabled} onChange={(e) => updateSlack({ enabled: e.target.checked })} />
          </div>
          <input type="text" placeholder="Webhook URL" value={localSettings.slack.webhookUrl} onChange={(e) => updateSlack({ webhookUrl: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white" />
        </div>
      )}

      {activeChannelTab === 'birdnet' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h4 className="text-sm font-black uppercase tracking-tight text-white">BirdNET-Go</h4>
            <input type="checkbox" checked={localSettings.birdnet?.enabled} onChange={(e) => updateBirdnet({ enabled: e.target.checked })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <input type="text" placeholder="Broker Host" value={localSettings.birdnet?.brokerHost || ''} onChange={(e) => updateBirdnet({ brokerHost: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white" />
             <input type="text" placeholder="Web URL" value={localSettings.birdnet?.serverUrl || ''} onChange={(e) => updateBirdnet({ serverUrl: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white" />
          </div>
        </div>
      )}

      {activeChannelTab === 'filters' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-md">
           <h4 className="text-sm font-black uppercase tracking-tight text-white">Alert Rules</h4>
           <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div><h4 className="text-xs font-black uppercase text-white">Ignore Parked Cars</h4></div>
              <button onClick={() => updateFilters({ ignoreParkedCars: !localSettings.filters.ignoreParkedCars })} className={`relative inline-flex h-5 w-10 rounded-full ${localSettings.filters.ignoreParkedCars ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                <span className={`h-4 w-4 transform rounded-full bg-white transition ${localSettings.filters.ignoreParkedCars ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
