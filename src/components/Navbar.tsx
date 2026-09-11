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
  Waves,
  Plane,
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
      // First try direct prebuilt static asset, fallback to /api/download-zip
      let res = await fetch('/watchtower-project.zip');
      if (!res.ok) {
        res = await fetch('/api/download-zip');
      }
      if (!res.ok) {
        throw new Error('Failed to fetch project zip');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'watchtower-project.zip';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      window.location.href = '/api/download-zip';
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <header className="w-full bg-slate-950 text-slate-100 border-b border-slate-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-4">
        {/* Editorial Top Masthead Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                Surveillance System
              </span>
              <span className="text-slate-500 font-mono text-xs tracking-widest px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 font-medium">
                v2.4.0-STABLE
              </span>
              <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Active</span>
              </div>
            </div>
            <div className="flex items-baseline gap-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter uppercase italic text-white leading-none">
                WatchTower
              </h1>
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest text-slate-500">
                Automated Real-Time Vision NVR
              </span>
            </div>
            <p className="mt-2 text-[10px] font-medium tracking-wide text-slate-600">
              Built on <span className="text-slate-400">Frigate NVR</span> by Blake Blackshear
              {' '}&amp;{' '}
              <span className="text-slate-400">BirdNET-Go</span> by Tomi Hakala
            </p>
          </div>

          {/* Editorial Quick Stats Bar */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-left md:text-right">
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-1.5 md:justify-end">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Uptime</p>
                {telemetry.isLive && (
                  <span className="text-[8px] px-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold animate-pulse">LIVE</span>
                )}
              </div>
              <p className="text-lg sm:text-xl font-mono font-bold text-emerald-400">
                {telemetry.uptimeFormatted}
              </p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Coral TPU</p>
              <p className="text-lg sm:text-xl font-mono font-bold text-white">
                {telemetry.coral.inferenceSpeedMs} <span className="text-xs text-slate-400 font-sans font-bold">ms</span>
              </p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Storage</p>
              <p className="text-lg sm:text-xl font-mono font-bold text-white">
                {Math.round((telemetry.storage.recordingsUsedGb / telemetry.storage.recordingsTotalGb) * 100)}%{' '}
                <span className="text-xs text-slate-400 font-sans font-bold">/ {telemetry.storage.recordingsTotalGb}GB</span>
              </p>
            </div>
            <div className="hidden xl:block p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Local Clock</p>
              <p className="text-lg sm:text-xl font-mono font-bold text-white tracking-wider">{currentTime || '12:00:00'}</p>
            </div>
          </div>
        </div>

        {/* Lower Navigation & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          {/* Tabs */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="nav-tab-live"
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'live'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeTab === 'live' ? 'bg-slate-950' : 'bg-red-500'}`} />
              <span>Live Streams</span>
            </button>

            <button
              id="nav-tab-events"
              onClick={() => setActiveTab('events')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'events'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <span>Review</span>
              {unreviewedCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded ${
                    activeTab === 'events' ? 'bg-slate-950 text-white' : 'bg-white text-slate-950'
                  }`}
                >
                  {unreviewedCount}
                </span>
              )}
            </button>

            <button
              id="nav-tab-birds"
              onClick={() => setActiveTab('birds')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'birds'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <Bird className="w-3.5 h-3.5 text-blue-400" />
              <span>Birds</span>
            </button>

            <button
              id="nav-tab-tides"
              onClick={() => setActiveTab('tides')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'tides'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <Waves className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tides</span>
            </button>

            <button
              id="nav-tab-flights"
              onClick={() => setActiveTab('flights')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'flights'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <Plane className="w-3.5 h-3.5 text-amber-400" />
              <span>Flights</span>
            </button>

            <button
              id="nav-tab-zones"
              onClick={() => setActiveTab('zones')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'zones'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <span>Zones Studio</span>
            </button>

            <button
              id="nav-tab-config"
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'config'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <span>Config YAML</span>
            </button>

            <button
              id="nav-tab-system"
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'system'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <span>Telemetry</span>
            </button>

            <button
              id="nav-tab-notifications"
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition-all ${
                activeTab === 'notifications'
                  ? 'bg-white text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-red-400" />
              <span>Notifications</span>
              {(notificationSettings?.gmail.enabled ||
                notificationSettings?.slack.enabled ||
                notificationSettings?.discord.enabled) && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              )}
            </button>
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2">
            {/* AI Natural Language Query */}
            <button
              id="btn-ai-search"
              onClick={onOpenAiSearch}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Search footage with Gemini AI natural language"
            >
              <Search className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">AI Query</span>
            </button>

            {/* Download Project ZIP */}
            <button
              id="btn-download-project-zip"
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition-all shadow-sm group disabled:opacity-60 cursor-pointer"
              title="Download entire project source code as ZIP"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce text-emerald-400' : 'text-slate-400 group-hover:text-white transition-colors'}`} />
              <span className="hidden sm:inline">{isDownloading ? 'Packaging...' : 'Download ZIP'}</span>
              <span className="sm:hidden text-[11px]">{isDownloading ? '...' : 'ZIP'}</span>
            </button>

            {/* Theme Toggle Option */}
            <button
              id="btn-toggle-theme"
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition-all shadow-sm group cursor-pointer"
              title={
                theme === 'slate-grey'
                  ? 'Current theme: Slate Grey. Click to switch to Midnight Obsidian'
                  : 'Current theme: Midnight Obsidian. Click to switch to Slate Grey'
              }
            >
              <Palette className={`w-3.5 h-3.5 ${theme === 'slate-grey' ? 'text-cyan-400' : 'text-slate-400 group-hover:text-white'} transition-colors`} />
              <span className="hidden sm:inline text-[11px]">
                {theme === 'slate-grey' ? 'Slate Grey' : 'Theme'}
              </span>
              <span
                className={`w-2 h-2 rounded-full border transition-all ${
                  theme === 'slate-grey'
                    ? 'bg-cyan-400 border-cyan-200 shadow-[0_0_6px_rgba(34,211,238,0.8)]'
                    : 'bg-slate-700 border-slate-500'
                }`}
              />
            </button>

            {/* MQTT Live Indicator Pill */}
            <button
              id="btn-mqtt-indicator"
              onClick={onOpenHostModal}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all shadow-sm ${
                mqttStatus?.connected
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-950/70'
                  : mqttStatus?.connecting
                  ? 'bg-amber-950/40 text-amber-300 border-amber-500/40 animate-pulse'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
              title={
                mqttStatus?.connected
                  ? `MQTT Live: Connected to ${mqttStatus.brokerUrl} (${mqttStatus.messageCount} msgs)`
                  : 'MQTT: Click to configure or view live broker status'
              }
            >
              <Radio className={`w-3.5 h-3.5 ${mqttStatus?.connected ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="hidden sm:inline text-[11px] font-bold">
                {mqttStatus?.connected ? 'MQTT LIVE' : mqttStatus?.connecting ? 'MQTT...' : 'MQTT OFF'}
              </span>
              {mqttStatus?.connected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>

            {/* Test Alarm Trigger */}
            <button
              id="btn-trigger-alarm"
              onClick={onTriggerSimulatedAlarm}
              className="flex items-center gap-1.5 p-2.5 rounded-xl text-slate-400 hover:text-amber-300 bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-colors shadow-sm"
              title="Trigger simulated perimeter intrusion alarm & test dispatch"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </button>

            {/* Host / Simulator Connector */}
            <button
              id="btn-host-connector"
              onClick={onOpenHostModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm"
              title="Manage Frigate Servers & MQTT credentials"
            >
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline text-[11px] font-bold text-white">
                  {activeServerName || (isLiveHostConnected ? 'LIVE NODE' : 'SIMULATOR')}
                </span>
                {isMqttActive && (
                  <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" title="MQTT Active" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
