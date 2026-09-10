import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CameraStream,
  FrigateEvent,
  ActiveTab,
  SystemTelemetryData,
  ZonePolygon,
  MotionMask,
  DetectedObject,
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
import { Bell, ShieldAlert, X } from 'lucide-react';

const DEFAULT_SERVERS: FrigateServerConfig[] = [
  {
    id: 'server-simulated',
    name: 'Simulation Engine (Embedded)',
    url: 'http://localhost:3000',
    isSimulated: true,
    isDefault: true,
    status: 'connected',
    version: 'v0.14.1-sim',
    detectedCamerasCount: 6,
    mqtt: {
      enabled: true,
      brokerHost: '127.0.0.1',
      port: 1883,
      protocol: 'mqtt',
      topicPrefix: 'frigate',
      connected: true,
    },
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [isReady, setIsReady] = useState(false);

  // Core state
  const [servers, setServers] = useState<FrigateServerConfig[]>(DEFAULT_SERVERS);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Per-session / Local state
  const [activeServerId, setActiveServerId] = useState<string>(DEFAULT_SERVERS[0].id);
  const [dummyCamerasEnabled, setDummyCamerasEnabled] = useState<boolean>(true);
  const [theme, setTheme] = useState<AppTheme>('midnight');

  const [cameras, setCameras] = useState<CameraStream[]>(INITIAL_CAMERAS);
  const [events, setEvents] = useState<FrigateEvent[]>(INITIAL_EVENTS);
  const [birdSightings, setBirdSightings] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetryData>(INITIAL_TELEMETRY);
  const [mqttStatus, setMqttStatus] = useState<MqttStatusInfo>({
    connected: false,
    connecting: false,
    brokerUrl: '',
    topicPrefix: 'frigate',
    messageCount: 0,
    error: null
  });

  // Modal states
  const [selectedCameraForDetail, setSelectedCameraForDetail] = useState<CameraStream | null>(null);
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [isAiSearchModalOpen, setIsAiSearchModalOpen] = useState(false);
  const [activeAlarmAlert, setActiveAlarmAlert] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const lastSyncedNotifRef = useRef<string>('');
  const lastSyncedServersRef = useRef<string>('');

  // 1. Initial Load from Backend & LocalStorage
  useEffect(() => {
    const init = async () => {
      try {
        // Load settings from server
        const notifRes = await fetch('/api/notifications/settings');
        const notifData = await notifRes.json();
        if (notifData.settings) {
          setNotificationSettings(notifData.settings);
          lastSyncedNotifRef.current = JSON.stringify(notifData.settings);
        }

        // Load servers from server
        const serversRes = await fetch('/api/frigate/servers');
        const serversData = await serversRes.json();
        if (Array.isArray(serversData.servers) && serversData.servers.length > 0) {
          setServers(serversData.servers);
          lastSyncedServersRef.current = JSON.stringify(serversData.servers);
        }

        // Load local-only preferences
        const savedTab = localStorage.getItem('frigate_active_tab');
        if (savedTab) setActiveTab(savedTab as ActiveTab);

        const savedServerId = localStorage.getItem('frigate_active_server_id');
        if (savedServerId) setActiveServerId(savedServerId);

        const savedTheme = localStorage.getItem('frigate_guardian_theme');
        if (savedTheme === 'slate-grey' || savedTheme === 'midnight') setTheme(savedTheme as AppTheme);

        const savedDummy = localStorage.getItem('frigate_dummy_cameras_enabled');
        if (savedDummy !== null) setDummyCamerasEnabled(JSON.parse(savedDummy));

      } catch (err) {
        console.warn('Backend init failed, using defaults');
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  // 2. Persistence Sync (Backend)
  useEffect(() => {
    if (!isReady) return;
    const configJson = JSON.stringify(notificationSettings);
    if (configJson !== lastSyncedNotifRef.current) {
      fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: notificationSettings }),
      }).then(() => {
        lastSyncedNotifRef.current = configJson;
      }).catch(err => console.error('Failed to sync settings:', err));
    }
  }, [notificationSettings, isReady]);

  useEffect(() => {
    if (!isReady) return;
    const serversJson = JSON.stringify(servers);
    if (serversJson !== lastSyncedServersRef.current) {
      fetch('/api/frigate/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers }),
      }).then(() => {
        lastSyncedServersRef.current = serversJson;
      }).catch(err => console.error('Failed to sync servers:', err));
    }
  }, [servers, isReady]);

  // 3. Local Persistence
  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem('frigate_active_tab', activeTab);
    localStorage.setItem('frigate_active_server_id', activeServerId);
    localStorage.setItem('frigate_guardian_theme', theme);
    localStorage.setItem('frigate_dummy_cameras_enabled', JSON.stringify(dummyCamerasEnabled));

    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [activeTab, activeServerId, theme, dummyCamerasEnabled, isReady]);

  const activeServer =
    servers.find((s) => s.id === activeServerId) ||
    servers[0] || DEFAULT_SERVERS[0];

  // Logic to sync background MQTT process when active server changes
  const lastSyncedMqttRef = useRef<string>('');
  useEffect(() => {
    if (!isReady || !activeServer || activeServer.isSimulated) return;

    if (activeServer.mqtt?.enabled && activeServer.mqtt.brokerHost) {
      const mqttConfig = {
        brokerHost: activeServer.mqtt.brokerHost,
        port: activeServer.mqtt.port,
        protocol: activeServer.mqtt.protocol,
        topicPrefix: activeServer.mqtt.topicPrefix || 'frigate',
        username: activeServer.mqtt.username,
        password: activeServer.mqtt.password,
        frigateServerUrl: activeServer.url,
      };

      const configJson = JSON.stringify(mqttConfig);
      if (configJson !== lastSyncedMqttRef.current) {
        fetch('/api/frigate/mqtt/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: configJson,
        }).then(() => {
          lastSyncedMqttRef.current = configJson;
        }).catch(err => console.warn('MQTT sync failed:', err));
      }
    }
  }, [activeServerId, servers, isReady]);

  // Telemetry Polling
  useEffect(() => {
    if (!isReady || !activeServer || activeServer.isSimulated || !activeServer.url) return;

    const fetchStats = async () => {
      try {
        const statsRes = await fetch(
          `/api/frigate/stats?serverUrl=${encodeURIComponent(activeServer.url)}${
            activeServer.apiKey ? `&apiKey=${encodeURIComponent(activeServer.apiKey)}` : ''
          }`
        );
        const statsData = await statsRes.json();
        if (statsData.success && statsData.telemetry) {
          setTelemetry({ ...statsData.telemetry, isLive: true });
        }
      } catch (_) {}
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [activeServer, isReady]);

  // Fetch Birds
  const handleFetchBirdSightings = useCallback(async () => {
    try {
      const res = await fetch('/api/birds/sightings');
      const data = await res.json();
      if (data.success && Array.isArray(data.sightings)) {
        setBirdSightings(data.sightings);
      }
    } catch (err) {
      console.warn('Failed to fetch birds:', err);
    }
  }, []);

  useEffect(() => {
    if (isReady) handleFetchBirdSightings();
  }, [isReady, handleFetchBirdSightings]);

  // SSE Stream
  useEffect(() => {
    if (!isReady) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/frigate/mqtt/stream');
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'status' && payload.status) {
            setMqttStatus(payload.status);
          } else if (payload.type === 'bird_sighting' && payload.sighting) {
            setBirdSightings((prev) => [payload.sighting, ...prev].slice(0, 500));
          } else if (payload.type === 'frigate_event' && payload.event) {
            const newEvt: FrigateEvent = payload.event;
            setEvents((prev) => {
              const index = prev.findIndex(e => e.id === newEvt.id);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = { ...updated[index], ...newEvt };
                return updated;
              }
              return [newEvt, ...prev];
            });
            setActiveAlarmAlert(`LIVE DETECTION: ${newEvt.label.toUpperCase()} on ${newEvt.camera.replace('_', ' ')}`);
          }
        } catch (_) {}
      };
    } catch (_) {}
    return () => { if (es) es.close(); };
  }, [isReady]);

  // Server Handlers
  const handleSyncServerCameras = useCallback(async (server?: FrigateServerConfig) => {
    const target = server || activeServer;
    if (!target || target.id === 'no-server') return;

    if (target.isSimulated) {
      setCameras(dummyCamerasEnabled ? INITIAL_CAMERAS : []);
      setEvents(INITIAL_EVENTS);
      return;
    }

    try {
      const configRes = await fetch('/api/frigate/servers/fetch-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.url, apiKey: target.apiKey }),
      });
      const configData = await configRes.json();
      if (configData.success && Array.isArray(configData.cameras)) setCameras(configData.cameras);

      const eventsRes = await fetch('/api/frigate/servers/fetch-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.url, apiKey: target.apiKey }),
      });
      const eventsData = await eventsRes.json();
      if (eventsData.success && Array.isArray(eventsData.events)) setEvents(eventsData.events);
    } catch (err) {
      console.warn('Sync failed:', err);
    }
  }, [activeServer, dummyCamerasEnabled]);

  const handleSelectServer = (serverId: string) => {
    setActiveServerId(serverId);
    const target = servers.find((s) => s.id === serverId);
    if (target) handleSyncServerCameras(target);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-blue-500 animate-pulse" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Initializing Guardian Dashboard...</p>
      </div>
    );
  }

  const displayedCameras = dummyCamerasEnabled || !activeServer.isSimulated ? cameras : [];
  const unreviewedCount = events.filter((e) => !e.reviewed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-white selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreviewedCount={unreviewedCount}
        telemetry={telemetry}
        isLiveHostConnected={!activeServer.isSimulated && activeServer.status === 'connected'}
        activeServerName={activeServer.name}
        isMqttActive={Boolean(activeServer.mqtt?.enabled)}
        mqttStatus={mqttStatus}
        notificationSettings={notificationSettings}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'midnight' ? 'slate-grey' : 'midnight')}
        onOpenHostModal={() => setIsHostModalOpen(true)}
        onOpenAiSearch={() => setIsAiSearchModalOpen(true)}
        onTriggerSimulatedAlarm={() => {}}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'live' && (
          <LiveGrid
            cameras={displayedCameras}
            activeServerName={activeServer.name}
            isLiveHostConnected={!activeServer.isSimulated && activeServer.status === 'connected'}
            telemetry={telemetry}
            onSelectCamera={setSelectedCameraForDetail}
            onToggleDetect={(id) => setCameras(prev => prev.map(c => c.id === id ? {...c, detectEnabled: !c.detectEnabled} : c))}
            onToggleRecord={(id) => setCameras(prev => prev.map(c => c.id === id ? {...c, recordEnabled: !c.recordEnabled} : c))}
            onResyncStreams={() => handleSyncServerCameras(activeServer)}
            onOpenHostModal={() => setIsHostModalOpen(true)}
          />
        )}

        {activeTab === 'events' && (
          <EventsReview
            events={events}
            cameras={displayedCameras}
            onMarkReviewed={(id) => setEvents(prev => prev.map(e => e.id === id ? {...e, reviewed: true} : e))}
            onMarkAllReviewed={() => setEvents(prev => prev.map(e => ({...e, reviewed: true})))}
            onClearAllEvents={() => setEvents([])}
            onDeleteEvent={(id) => setEvents(prev => prev.filter(e => e.id !== id))}
            onUpdateEventAiSummary={(id, s, t, a) => setEvents(prev => prev.map(e => e.id === id ? {...e, summary: s, threatLevel: t, recommendedAction: a, isAiAnalyzed: true} : e))}
            onRefreshEvents={() => handleSyncServerCameras(activeServer)}
            isLiveServerConnected={!activeServer.isSimulated}
          />
        )}

        {activeTab === 'birds' && (
          <BirdSightingsView
            sightings={birdSightings}
            config={notificationSettings.birdnet}
            onRefresh={handleFetchBirdSightings}
            onClear={() => { fetch('/api/birds/clear', { method: 'POST' }).then(() => setBirdSightings([])); }}
          />
        )}

        {activeTab === 'tides' && (
          <TideView config={notificationSettings.tides || { stations: [], refreshIntervalMinutes: 60 }} />
        )}

        {activeTab === 'zones' && (
          <ZoneEditor cameras={displayedCameras} onSaveZones={(id, z, m) => setCameras(prev => prev.map(c => c.id === id ? {...c, zones: z, motionMasks: m} : c))} />
        )}

        {activeTab === 'config' && <ConfigStudio onRestartEngine={() => {}} />}

        {activeTab === 'system' && (
          <SystemTelemetry telemetry={telemetry} cameras={displayedCameras} theme={theme} onSetTheme={setTheme} />
        )}

        {activeTab === 'notifications' && (
          <NotificationSettingsView
            settings={notificationSettings}
            onUpdateSettings={setNotificationSettings}
            availableCameras={displayedCameras.map((c) => ({ id: c.id, name: c.name }))}
          />
        )}
      </main>

      {selectedCameraForDetail && (
        <CameraDetailModal
          camera={selectedCameraForDetail}
          onClose={() => setSelectedCameraForDetail(null)}
          onSwitchStreamType={(id, type) => setCameras(prev => prev.map(c => c.id === id ? {...c, streamType: type} : c))}
        />
      )}

      <HostConnectorModal
        isOpen={isHostModalOpen}
        onClose={() => setIsHostModalOpen(false)}
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onAddServer={(s) => { setServers(prev => [...prev, s]); setActiveServerId(s.id); handleSyncServerCameras(s); }}
        onDeleteServer={(id) => { const next = servers.filter(s => s.id !== id); setServers(next); if (activeServerId === id) setActiveServerId(next[0]?.id || ''); }}
        onUpdateServer={(s) => { setServers(prev => prev.map(old => old.id === s.id ? s : old)); handleSyncServerCameras(s); }}
        onSyncServerCameras={handleSyncServerCameras}
        notificationSettings={notificationSettings}
        onUpdateNotificationSettings={setNotificationSettings}
        dummyCamerasEnabled={dummyCamerasEnabled}
        onToggleDummyCameras={setDummyCamerasEnabled}
        onRestoreDummyServer={() => { setServers(prev => prev.some(s => s.id === 'server-simulated') ? prev : [DEFAULT_SERVERS[0], ...prev]); setActiveServerId('server-simulated'); }}
        availableCameras={cameras.map((c) => ({ id: c.id, name: c.name }))}
      />

      <GeminiSearchModal isOpen={isAiSearchModalOpen} onClose={() => setIsAiSearchModalOpen(false)} events={events} onSelectEvent={() => setActiveTab('events')} />
    </div>
  );
}
