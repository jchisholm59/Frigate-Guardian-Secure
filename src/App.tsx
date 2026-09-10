import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CameraStream, FrigateEvent, ActiveTab, SystemTelemetryData, FrigateServerConfig, NotificationSettings, AppTheme, MqttStatusInfo } from './types';
import { INITIAL_CAMERAS, INITIAL_EVENTS, INITIAL_TELEMETRY } from './mockData';
import { Navbar } from './components/Navbar';
import { LiveGrid } from './components/LiveGrid';
import { EventsReview } from './components/EventsReview';
import { ZoneEditor } from './components/ZoneEditor';
import { BirdSightingsView } from './components/BirdSightingsView';
import { ConfigStudio } from './components/ConfigStudio';
import { SystemTelemetry } from './components/SystemTelemetry';
import { CameraDetailModal } from './components/CameraDetailModal';
import { HostConnectorModal } from './components/HostConnectorModal';
import { GeminiSearchModal } from './components/GeminiSearchModal';
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettingsView } from './components/NotificationSettingsView';
import { ShieldAlert } from 'lucide-react';

const DEFAULT_SERVERS: FrigateServerConfig[] = [
  { id: 'server-simulated', name: 'Simulation Node', url: 'http://localhost:3000', isSimulated: true, status: 'connected', mqtt: { enabled: true, brokerHost: '127.0.0.1', port: 1883 } }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [isReady, setIsReady] = useState(false);
  const [servers, setServers] = useState<FrigateServerConfig[]>(DEFAULT_SERVERS);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [activeServerId, setActiveServerId] = useState<string>(DEFAULT_SERVERS[0].id);
  const [dummyCamerasEnabled, setDummyCamerasEnabled] = useState(true);
  const [theme, setTheme] = useState<AppTheme>('midnight');
  const [cameras, setCameras] = useState<CameraStream[]>(INITIAL_CAMERAS);
  const [events, setEvents] = useState<FrigateEvent[]>(INITIAL_EVENTS);
  const [birdSightings, setBirdSightings] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetryData>(INITIAL_TELEMETRY);
  const [mqttStatus, setMqttStatus] = useState<MqttStatusInfo>({ connected: false, brokerUrl: '', topicPrefix: 'frigate', messageCount: 0, error: null, lastReceivedAt: null });

  const [selectedCamera, setSelectedCamera] = useState<CameraStream | null>(null);
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [isAiSearchOpen, setIsAiSearchOpen] = useState(false);

  useEffect(() => {
    const boot = async () => {
      try {
        const [nR, sR] = await Promise.all([
          fetch('/api/notifications/settings').then(r => r.json()).catch(() => ({})),
          fetch('/api/frigate/servers').then(r => r.json()).catch(() => ({}))
        ]);
        if (nR.settings) setNotificationSettings(nR.settings);
        if (Array.isArray(sR.servers)) setServers(sR.servers);
        const t = localStorage.getItem('fg_tab'); if (t) setActiveTab(t as ActiveTab);
        const s = localStorage.getItem('fg_server'); if (s) setActiveServerId(s);
      } catch (e) {} finally { setIsReady(true); }
    };
    boot();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem('fg_tab', activeTab);
    localStorage.setItem('fg_server', activeServerId);
    document.documentElement.setAttribute('data-theme', theme);
  }, [activeTab, activeServerId, theme, isReady]);

  const activeServer = servers.find(s => s.id === activeServerId) || servers[0] || DEFAULT_SERVERS[0];

  const handleSync = useCallback(async () => {
    if (!activeServer || activeServer.isSimulated) return;
    try {
      const cR = await fetch('/api/frigate/servers/fetch-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: activeServer.url, apiKey: activeServer.apiKey }) }).then(r => r.json());
      if (cR.success) setCameras(cR.cameras);
    } catch (e) {}
  }, [activeServer]);

  useEffect(() => { if (isReady) handleSync(); }, [activeServerId, isReady, handleSync]);

  if (!isReady) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest">Restoring Guardian...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab} setActiveTab={setActiveTab} unreviewedCount={events.length} telemetry={telemetry}
        isLiveHostConnected={!activeServer.isSimulated} activeServerName={activeServer.name}
        mqttStatus={mqttStatus} notificationSettings={notificationSettings} theme={theme}
        onToggleTheme={() => setTheme(t => t === 'midnight' ? 'slate-grey' : 'midnight')}
        onOpenHostModal={() => setIsHostModalOpen(true)} onOpenAiSearch={() => setIsAiSearchOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        {activeTab === 'live' && <LiveGrid cameras={cameras} telemetry={telemetry} onSelectCamera={setSelectedCamera} onToggleDetect={() => {}} onToggleRecord={() => {}} onResyncStreams={handleSync} onOpenHostModal={() => setIsHostModalOpen(true)} />}
        {activeTab === 'events' && <EventsReview events={events} cameras={cameras} onMarkReviewed={() => {}} onMarkAllReviewed={() => {}} onClearAllEvents={() => {}} onDeleteEvent={() => {}} onUpdateEventAiSummary={() => {}} onRefreshEvents={handleSync} isLiveServerConnected={!activeServer.isSimulated} />}
        {activeTab === 'birds' && <BirdSightingsView sightings={birdSightings} config={notificationSettings.birdnet} onRefresh={() => {}} onClear={() => setBirdSightings([])} />}
        {activeTab === 'notifications' && <NotificationSettingsView settings={notificationSettings} onUpdateSettings={setNotificationSettings} availableCameras={cameras.map(c => ({ id: c.id, name: c.name }))} />}
        {activeTab === 'system' && <SystemTelemetry telemetry={telemetry} cameras={cameras} theme={theme} onSetTheme={setTheme} />}
      </main>

      {selectedCamera && <CameraDetailModal camera={selectedCamera} onClose={() => setSelectedCamera(null)} onSwitchStreamType={() => {}} />}
      <HostConnectorModal isOpen={isHostModalOpen} onClose={() => setIsHostModalOpen(false)} servers={servers} activeServerId={activeServerId} onSelectServer={setActiveServerId} onAddServer={s => setServers(p => [...p, s])} onDeleteServer={id => setServers(p => p.filter(x => x.id !== id))} onUpdateServer={s => setServers(p => p.map(x => x.id === s.id ? s : x))} onSyncServerCameras={handleSync} notificationSettings={notificationSettings} onUpdateNotificationSettings={setNotificationSettings} dummyCamerasEnabled={dummyCamerasEnabled} onToggleDummyCameras={setDummyCamerasEnabled} onRestoreDummyServer={() => {}} availableCameras={cameras.map(c => ({ id: c.id, name: c.name }))} />
      <GeminiSearchModal isOpen={isAiSearchOpen} onClose={() => setIsAiSearchOpen(false)} events={events} onSelectEvent={() => setActiveTab('events')} />
    </div>
  );
}
