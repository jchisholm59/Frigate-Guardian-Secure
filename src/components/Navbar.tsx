import React, { useState, useEffect } from 'react';
import {
  Shield,
  Camera,
  Layers,
  Sliders,
  Cpu,
  Search,
  Server,
  Radio,
  Bell,
  HardDrive,
  Download,
  Zap,
  Palette,
  Bird,
} from 'lucide-react';
import { ActiveTab, SystemTelemetryData, MqttStatusInfo, NotificationSettings, AppTheme } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  unreviewedCount: number;
  telemetry: SystemTelemetryData;
  isLiveHostConnected: boolean;
  activeServerName?: string;
  isMqttActive?: boolean;
  mqttStatus?: MqttStatusInfo;
  notificationSettings?: NotificationSettings;
  theme?: AppTheme;
  onToggleTheme?: () => void;
  onOpenHostModal: () => void;
  onOpenAiSearch: () => void;
  onTriggerSimulatedAlarm: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  unreviewedCount,
  telemetry,
  isLiveHostConnected,
  activeServerName,
  isMqttActive,
  mqttStatus,
  notificationSettings,
  theme = 'midnight',
  onToggleTheme,
  onOpenHostModal,
  onOpenAiSearch,
  onTriggerSimulatedAlarm,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadZip = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      let res = await fetch('/frigate-guardian-project.zip');
      if (!res.ok) res = await fetch('/api/download-zip');
      if (!res.ok) throw new Error('Failed to fetch project zip');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'frigate-guardian-project.zip';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      window.location.href = '/api/download-zip';
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <header className="w-full bg-slate-950 text-slate-100 border-b border-slate-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Surveillance System</span>
              <span className="text-slate-500 font-mono text-xs tracking-widest px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 font-medium">v2.4.0-STABLE</span>
              <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Active</span>
              </div>
            </div>
            <div className="flex items-baseline gap-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter uppercase italic text-white leading-none">Frigate Guardian</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-left md:text-right">
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Uptime</p>
              <p className="text-lg sm:text-xl font-mono font-bold text-emerald-400">{telemetry?.uptimeFormatted || '00:00:00'}</p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Coral TPU</p>
              <p className="text-lg sm:text-xl font-mono font-bold text-white">{telemetry?.coral?.inferenceSpeedMs || '0.0'} <span className="text-xs text-slate-400 font-sans font-bold">ms</span></p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Storage</p>
              <p className="text-lg sm:text-xl font-mono font-bold text-white">
                {telemetry?.storage?.recordingsTotalGb ? Math.round(((telemetry.storage.recordingsUsedGb || 0) / telemetry.storage.recordingsTotalGb) * 100) : 0}%{' '}
                <span className="text-xs text-slate-400 font-sans font-bold">/ {telemetry?.storage?.recordingsTotalGb || 0}GB</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={() => setActiveTab('live')} className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${activeTab === 'live' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'live' ? 'bg-slate-950' : 'bg-red-500'}`} />
              <span>Live Streams</span>
            </button>
            <button onClick={() => setActiveTab('events')} className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${activeTab === 'events' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}>
              <span>Review</span>
              {unreviewedCount > 0 && <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded ${activeTab === 'events' ? 'bg-slate-950 text-white' : 'bg-white text-slate-950'}`}>{unreviewedCount}</span>}
            </button>
            <button onClick={() => setActiveTab('birds')} className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${activeTab === 'birds' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}>
              <Bird className="w-3.5 h-3.5 text-blue-400" />
              <span>Birds</span>
            </button>
            <button onClick={() => setActiveTab('zones')} className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${activeTab === 'zones' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}>
              <span>Zones Studio</span>
            </button>
            <button onClick={() => setActiveTab('notifications')} className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${activeTab === 'notifications' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}>
              <Bell className="w-3.5 h-3.5 text-red-400" />
              <span>Notifications</span>
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={onOpenAiSearch} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition-all shadow-sm">
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Query</span>
            </button>
            <button onClick={onToggleTheme} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition-all shadow-sm">
              <Palette className={`w-3.5 h-3.5 ${theme === 'slate-grey' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline text-[11px]">{theme === 'slate-grey' ? 'Slate' : 'Midnight'}</span>
            </button>
            <button onClick={onOpenHostModal} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline text-[11px] font-bold text-white">{activeServerName || 'SERVER'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
