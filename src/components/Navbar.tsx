import React, { useState, useEffect } from 'react';
import { Shield, Camera, Layers, Sliders, Cpu, Search, Server, Radio, Bell, HardDrive, Download, Zap, Palette, Bird } from 'lucide-react';
import { ActiveTab, SystemTelemetryData, MqttStatusInfo, NotificationSettings, AppTheme } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  unreviewedCount: number;
  telemetry: SystemTelemetryData;
  isLiveHostConnected: boolean;
  activeServerName?: string;
  mqttStatus?: MqttStatusInfo;
  notificationSettings?: NotificationSettings;
  theme?: AppTheme;
  onToggleTheme?: () => void;
  onOpenHostModal: () => void;
  onOpenAiSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab, setActiveTab, unreviewedCount, telemetry,
  isLiveHostConnected, activeServerName, mqttStatus, notificationSettings,
  theme = 'midnight', onToggleTheme, onOpenHostModal, onOpenAiSearch
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full bg-slate-950 text-slate-100 border-b border-slate-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Guardian NVR System</span>
              <span className="text-slate-500 font-mono text-xs tracking-widest px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">v2.4.0-STABLE</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase italic text-white leading-none">Frigate Guardian</h1>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-left md:text-right">
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Uptime</p>
              <p className="text-lg font-mono font-bold text-emerald-400">{telemetry?.uptimeFormatted || '00:00:00'}</p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Coral TPU</p>
              <p className="text-lg font-mono font-bold text-white">{telemetry?.coral?.inferenceSpeedMs || '0.0'} ms</p>
            </div>
            <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Local Clock</p>
              <p className="text-lg font-mono font-bold text-white tracking-wider">{currentTime || '12:00:00'}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={() => setActiveTab('live')} className={`px-4 py-2 text-xs uppercase font-black rounded-xl transition-all ${activeTab === 'live' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>Live Streams</button>
            <button onClick={() => setActiveTab('events')} className={`px-4 py-2 text-xs uppercase font-black rounded-xl transition-all ${activeTab === 'events' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>Review {unreviewedCount > 0 && <span className="bg-red-500 text-white px-1.5 rounded ml-1">{unreviewedCount}</span>}</button>
            <button onClick={() => setActiveTab('birds')} className={`px-4 py-2 text-xs uppercase font-black rounded-xl transition-all ${activeTab === 'birds' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>Birds</button>
            <button onClick={() => setActiveTab('zones')} className={`px-4 py-2 text-xs uppercase font-black rounded-xl transition-all ${activeTab === 'zones' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>Zones</button>
            <button onClick={() => setActiveTab('notifications')} className={`px-4 py-2 text-xs uppercase font-black rounded-xl transition-all ${activeTab === 'notifications' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>Settings</button>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={onOpenAiSearch} className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase bg-slate-900 border border-slate-800 text-slate-200 hover:text-white transition-all"><Search className="w-3.5 h-3.5" /></button>
            <button onClick={onOpenHostModal} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all"><Server className="w-3.5 h-3.5" /><span className="hidden sm:inline">{activeServerName || 'SERVER'}</span></button>
          </div>
        </div>
      </div>
    </header>
  );
};
