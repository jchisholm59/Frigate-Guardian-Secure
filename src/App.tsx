import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CameraStream,
  FrigateEvent,
  ActiveTab,
  SystemTelemetryData,
  FrigateServerConfig,
  NotificationSettings,
  AppTheme,
  MqttStatusInfo,
} from './types';
import { INITIAL_CAMERAS, INITIAL_EVENTS, INITIAL_TELEMETRY } from './mockData';
import { Navbar } from './components/Navbar';
import { LiveGrid } from './components/LiveGrid';
import { EventsReview } from './components/EventsReview';
import { ZoneEditor } from './components/ZoneEditor';
import { BirdSightingsView } from './components/BirdSightingsView';
import { TideView } from './components/TideView';
import { ConfigStudio } from './components/ConfigStudio';
import { SystemTelemetry } from './components/SystemTelemetry';
import { CameraDetailModal } from './components/CameraDetailModal';
import { HostConnectorModal } from './components/HostConnectorModal';
import { GeminiSearchModal } from './components/GeminiSearchModal';
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettingsView } from './components/NotificationSettingsView';
import { ShieldAlert } from 'lucide-react';

const DEFAULT_SERVERS: FrigateServerConfig[] = [
  {
    id: 'server-simulated',
    name: 'Simulation Engine (Embedded)',
    url: 'http://localhost:3000',
    isSimulated: true,
    status: 'connected',
    mqtt: { enabled: true, brokerHost: '127.0.0.1', port: 1883, protocol: 'mqtt', topicPrefix: 'frigate', connected: true },
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [isReady, setIsReady] = useState(false);

  // Global Sync State
  const [servers, setServers] = useState<FrigateServerConfig[]>(DEFAULT_SERVERS);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Local Settings
  const [activeServerId, setActiveServerId] = useState<string>(DEFAULT_SERVERS[0].id);
  const [dummyCamerasEnabled, setDummyCamerasEnabled] = useState<boolean>(true);
  const [theme, setTheme] = useState<AppTheme>('midnight');

  // Real-time Data
  const [cameras, setCameras] = useState<CameraStream[]>(INITIAL_CAMERAS);
  const [events, setEvents] = useState<FrigateEvent[]>(INITIAL_EVENTS);
  const [birdSightings, setBirdSightings] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetryData>(INITIAL_TELEMETRY);
  const [mqttStatus, setMqttStatus] = useState<MqttStatusInfo>({ connected: false, brokerUrl: '', topicPrefix: 'frigate', messageCount: 0 });

  const [selectedCamera, setSelectedCamera] = useState<CameraStream | null>(null);
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [isAiSearchOpen, setIsAiSearchOpen] = useState(false);

  const lastSyncedNotifRef = useRef<string>('');
  const lastSyncedServersRef = useRef<string>('');

  // 1. Core Boot Sequence
  useEffect(() => {
    const boot = async () => {
      try {
        const [notifRes, serversRes] = await Promise.all([
          fetch('/api/notifications/settings').then(r => r.json()),
          fetch('/api/frigate/servers').then(r => r.json())
        ]);

        if (notifRes.settings) {
          setNotificationSettings(notifRes.settings);
          lastSyncedNotifRef.current = JSON.stringify(notifRes.settings);
        }
        if (Array.isArray(serversRes.servers) && serversRes.servers.length > 0) {
          setServers(serversRes.servers);
          lastSyncedServersRef.current = JSON.stringify(serversRes.servers);
        }

        // Restore local UI preferences
        const sTab = localStorage.getItem('frigate_active_tab'); if (sTab) setActiveTab(sTab as ActiveTab);
        const sId = localStorage.getItem('frigate_active_server_id'); if (sId) setActiveServerId(sId);
        const sTheme = localStorage.getItem('frigate_guardian_theme'); if (sTheme) setTheme(sTheme as AppTheme);
        const sDummy = localStorage.getItem('frigate_dummy_enabled'); if (sDummy !== null) setDummyCamerasEnabled(JSON.parse(sDummy));

      } catch (err) {
        console.warn('Backend connection failed. Running in standalone mode.');
      } finally {
        setIsReady(true);
      }
    };
    boot();
  }, []);

  // 2. Global Sync (Outbound)
  useEffect(() => {
    if (!isReady) return;
    const json = JSON.stringify(notificationSettings);
    if (json !== lastSyncedNotifRef.current) {
      fetch('/api/notifications/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: notificationSettings }) })
        .then(() => { lastSyncedNotifRef.current = json; });
    }
  }, [notificationSettings, isReady]);

  useEffect(() => {
    if (!isReady) return;
    const json = JSON.stringify(servers);
    if (json !== lastSyncedServersRef.current) {
      fetch('/api/frigate/servers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ servers }) })
        .then(() => { lastSyncedServersRef.current = json; });
    }
  }, [servers, isReady]);

  // 3. Local Store & Theme
  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem('frigate_active_tab', activeTab);
    localStorage.setItem('frigate_active_server_id', activeServerId);
    localStorage.setItem('frigate_guardian_theme', theme);
    localStorage.setItem('frigate_dummy_enabled', JSON.stringify(dummyCamerasEnabled));
    document.documentElement.setAttribute('data-theme', theme);
  }, [activeTab, activeServerId, theme, dummyCamerasEnabled, isReady]);

  const activeServer = servers.find(s => s.id === activeServerId) || servers[0] || DEFAULT_SERVERS[0];

  // 4. Frigate Data Sync
  const handleSyncServer = useCallback(async (targetServer?: FrigateServerConfig) => {
    const target = targetServer || activeServer;
    if (!target || target.isSimulated) {
      setCameras(dummyCamerasEnabled ? INITIAL_CAMERAS : []);
      setEvents(INITIAL_EVENTS);
      return;
    }
    try {
      const [cRes, eRes, sRes] = await Promise.all([
        fetch('/api/frigate/servers/fetch-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target.url, apiKey: target.apiKey }) }).then(r => r.json()),
        fetch('/api/frigate/servers/fetch-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target.url, apiKey: target.apiKey }) }).then(r => r.json()),
        fetch(`/api/frigate/stats?serverUrl=${encodeURIComponent(target.url)}${target.apiKey ? `&apiKey=${encodeURIComponent(target.apiKey)}` : ''}`).then(r => r.json())
      ]);
      if (cRes.success) setCameras(cRes.cameras);
      if (eRes.success) setEvents(eRes.events);
      if (sRes.success) setTelemetry(sRes.telemetry);
    } catch (e) { console.warn('Sync error:', e); }
  }, [activeServer, dummyCamerasEnabled]);

  useEffect(() => { if (isReady) handleSyncServer(); }, [activeServerId, isReady, handleSyncServer]);

  // 5. SSE Real-time Feed
  useEffect(() => {
    if (!isReady) return;
    const es = new EventSource('/api/frigate/mqtt/stream');
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'bird_sighting') setBirdSightings(prev => [payload.sighting, ...prev].slice(0, 500));
        if (payload.type === 'frigate_event') {
          setEvents(prev => {
            const idx = prev.findIndex(ev => ev.id === payload.event.id);
            if (idx !== -1) { const upd = [...prev]; upd[idx] = { ...upd[idx], ...payload.event }; return upd; }
            return [payload.event, ...prev];
          });
        }
      } catch (err) {}
    };
    return () => es.close();
  }, [isReady]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-blue-500 animate-pulse" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 text-center">Guardian Shield Active<br/>Securing Yard Intelligence...</p>
      </div>
    );
  }

  const displayedCameras = dummyCamerasEnabled || !activeServer.isSimulated ? cameras : [];
  const unreviewedCount = events.filter(e => !e.reviewed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-white selection:text-slate-950">
      <Navbar
        activeTab={activeTab} setActiveTab={setActiveTab} unreviewedCount={unreviewedCount} telemetry={telemetry}
        isLiveHostConnected={!activeServer.isSimulated && activeServer.status === 'connected'}
        activeServerName={activeServer.name} isMqttActive={Boolean(activeServer.mqtt?.enabled)}
        mqttStatus={mqttStatus} notificationSettings={notificationSettings} theme={theme}
        onToggleTheme={() => setTheme(t => t === 'midnight' ? 'slate-grey' : 'midnight')}
        onOpenHostModal={() => setIsHostModalOpen(true)} onOpenAiSearch={() => setIsAiSearchOpen(true)}
        onTriggerSimulatedAlarm={() => {}}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'live' && (
          <LiveGrid
            cameras={displayedCameras} activeServerName={activeServer.name}
            telemetry={telemetry} onSelectCamera={setSelectedCamera}
            onToggleDetect={(id) => setCameras(prev => prev.map(c => c.id === id ? {...c, detectEnabled: !c.detectEnabled} : c))}
            onToggleRecord={(id) => setCameras(prev => prev.map(c => c.id === id ? {...c, recordEnabled: !c.recordEnabled} : c))}
            onResyncStreams={() => handleSyncServer(activeServer)} onOpenHostModal={() => setIsHostModalOpen(true)}
          />
        )}

        {activeTab === 'events' && (
          <EventsReview
            events={events} cameras={displayedCameras}
            onMarkReviewed={(id) => setEvents(prev => prev.map(e => e.id === id ? {...e, reviewed: true} : e))}
            onMarkAllReviewed={() => setEvents(prev => prev.map(e => ({...e, reviewed: true})))}
            onClearAllEvents={() => setEvents([])} onDeleteEvent={(id) => setEvents(prev => prev.filter(e => e.id !== id))}
            onUpdateEventAiSummary={(id, s, t, a) => setEvents(prev => prev.map(e => e.id === id ? {...e, summary: s, threatLevel: t, recommendedAction: a, isAiAnalyzed: true} : e))}
            onRefreshEvents={() => handleSyncServer(activeServer)} isLiveServerConnected={!activeServer.isSimulated}
          />
        )}

        {activeTab === 'birds' && (
          <BirdSightingsView
            sightings={birdSightings} config={notificationSettings.birdnet}
            onRefresh={() => fetch('/api/birds/sightings').then(r => r.json()).then(d => d.success && setBirdSightings(d.sightings))}
            onClear={() => { fetch('/api/birds/clear', { method: 'POST' }).then(() => setBirdSightings([])); }}
          />
        )}

        {activeTab === 'tides' && <TideView config={notificationSettings.tides || { stations: [], refreshIntervalMinutes: 60 }} />}

        {activeTab === 'zones' && <ZoneEditor cameras={displayedCameras} onSaveZones={(id, z, m) => setCameras(prev => prev.map(c => c.id === id ? {...c, zones: z, motionMasks: m} : c))} />}
        {activeTab === 'config' && <ConfigStudio onRestartEngine={() => {}} />}
        {activeTab === 'system' && <SystemTelemetry telemetry={telemetry} cameras={displayedCameras} theme={theme} onSetTheme={setTheme} />}
        {activeTab === 'notifications' && <NotificationSettingsView settings={notificationSettings} onUpdateSettings={setNotificationSettings} availableCameras={displayedCameras.map(c => ({ id: c.id, name: c.name }))} />}
      </main>

      {selectedCamera && <CameraDetailModal camera={selectedCamera} onClose={() => setSelectedCamera(null)} onSwitchStreamType={(id, type) => setCameras(prev => prev.map(c => c.id === id ? {...c, streamType: type} : c))} />}

      <HostConnectorModal
        isOpen={isHostModalOpen} onClose={() => setIsHostModalOpen(false)}
        servers={servers} activeServerId={activeServerId} onSelectServer={sId => setActiveServerId(sId)}
        onAddServer={s => { setServers(p => [...p, s]); setActiveServerId(s.id); }}
        onDeleteServer={id => { const n = servers.filter(s => s.id !== id); setServers(n); if (activeServerId === id) setActiveServerId(n[0]?.id || ''); }}
        onUpdateServer={s => setServers(p => p.map(o => o.id === s.id ? s : o))}
        onSyncServerCameras={handleSyncServer} notificationSettings={notificationSettings} onUpdateNotificationSettings={setNotificationSettings}
        dummyCamerasEnabled={dummyCamerasEnabled} onToggleDummyCameras={setDummyCamerasEnabled}
        onRestoreDummyServer={() => { setServers(p => p.some(s => s.id === 'server-simulated') ? p : [DEFAULT_SERVERS[0], ...p]); setActiveServerId('server-simulated'); }}
        availableCameras={cameras.map(c => ({ id: c.id, name: c.name }))}
      />

      <GeminiSearchModal isOpen={isAiSearchOpen} onClose={() => setIsAiSearchOpen(false)} events={events} onSelectEvent={() => setActiveTab('events')} />
    </div>
  );
}
