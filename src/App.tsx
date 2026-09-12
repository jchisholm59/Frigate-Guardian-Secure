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
import { FlightsView } from './components/FlightsView';
import { WeatherView } from './components/WeatherView';
import { ConfigStudio } from './components/ConfigStudio';
import { SystemTelemetry } from './components/SystemTelemetry';
import { CameraDetailModal } from './components/CameraDetailModal';
import { HostConnectorModal } from './components/HostConnectorModal';
import { GeminiSearchModal } from './components/GeminiSearchModal';
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettingsView } from './components/NotificationSettingsView';
import { LoginView } from './components/LoginView';
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

function Dashboard({ authEnabled, onLogout }: { authEnabled: boolean; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');

  // Dummy camera option state (persisted)
  const [dummyCamerasEnabled, setDummyCamerasEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('frigate_dummy_cameras_enabled');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {}
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem('frigate_dummy_cameras_enabled', JSON.stringify(dummyCamerasEnabled));
    } catch (e) {}
  }, [dummyCamerasEnabled]);

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('frigate_notification_settings');
      if (saved) return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_NOTIFICATION_SETTINGS;
  });

  // Becomes true once we've loaded server-side settings on boot. Until then we
  // don't push local state up, so a fresh browser can't overwrite the server's
  // saved config with its own defaults before we've read it.
  const hydratedRef = useRef(false);

  const lastSyncedNotifRef = useRef<string>('');
  useEffect(() => {
    try {
      localStorage.setItem('frigate_notification_settings', JSON.stringify(notificationSettings));
      if (!hydratedRef.current) return;

      const configJson = JSON.stringify(notificationSettings);
      // Only sync if the configuration HAS ACTUALLY CHANGED to avoid infinite loops
      if (configJson !== lastSyncedNotifRef.current) {
        fetch('/api/notifications/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: notificationSettings }),
        }).then(() => {
          lastSyncedNotifRef.current = configJson;
        }).catch(err => console.error('Failed to sync notification settings to server:', err));
      }
    } catch (e) {}
  }, [notificationSettings]);

  // Theme state (persisted: 'midnight' | 'slate-grey')
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('frigate_guardian_theme');
      if (saved === 'slate-grey' || saved === 'midnight') return saved;
    } catch (e) {}
    return 'midnight';
  });

  useEffect(() => {
    try {
      localStorage.setItem('frigate_guardian_theme', theme);
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'slate-grey' ? 'midnight' : 'slate-grey'));
  };

  // Multi-server state
  const [servers, setServers] = useState<FrigateServerConfig[]>(() => {
    try {
      const saved = localStorage.getItem('frigate_configured_servers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_SERVERS;
  });

  const [activeServerId, setActiveServerId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('frigate_active_server_id');
      if (savedId) return savedId;
    } catch (e) {}
    return DEFAULT_SERVERS[0]?.id || '';
  });

  const activeServer =
    servers.find((s) => s.id === activeServerId) ||
    servers[0] || {
      id: 'no-server',
      name: 'No Server Connected',
      url: '',
      isSimulated: false,
      status: 'disconnected',
    };

  // Sync Active Server MQTT settings to server process
  const lastSyncedMqttRef = useRef<string>('');
  useEffect(() => {
    if (activeServer && !activeServer.isSimulated && activeServer.mqtt?.enabled && activeServer.mqtt.brokerHost) {
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

      // Only sync if the configuration HAS ACTUALLY CHANGED to avoid infinite loops
      if (configJson !== lastSyncedMqttRef.current) {
        console.log('[MQTT] Syncing active server config to background process...');
        fetch('/api/frigate/mqtt/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: configJson,
        }).then(() => {
          lastSyncedMqttRef.current = configJson;
        }).catch(err => console.warn('Background MQTT auto-sync failed:', err));
      }
    }
  }, [activeServerId, servers]);

  const [cameras, setCameras] = useState<CameraStream[]>(() => {
    return dummyCamerasEnabled ? INITIAL_CAMERAS : [];
  });
  const [events, setEvents] = useState<FrigateEvent[]>(INITIAL_EVENTS);
  const [birdSightings, setBirdSightings] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetryData>(INITIAL_TELEMETRY);
  const [mqttStatus, setMqttStatus] = useState<MqttStatusInfo>({
    connected: false,
    connecting: false,
    brokerUrl: '',
    topicPrefix: 'frigate',
    messageCount: 0,
  });

  // Modal states
  const [selectedCameraForDetail, setSelectedCameraForDetail] = useState<CameraStream | null>(null);
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [isAiSearchModalOpen, setIsAiSearchModalOpen] = useState(false);
  const [activeAlarmAlert, setActiveAlarmAlert] = useState<string | null>(null);
  const [tideAlert, setTideAlert] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  // Persist servers — locally, and (once hydrated) server-side so the same
  // list of Frigate hosts shows up on every browser / device.
  const lastSyncedServersRef = useRef<string>('');
  useEffect(() => {
    try {
      localStorage.setItem('frigate_configured_servers', JSON.stringify(servers));
      if (!hydratedRef.current) return;

      const json = JSON.stringify(servers);
      if (json !== lastSyncedServersRef.current) {
        fetch('/api/frigate/servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ servers }),
        }).then(() => {
          lastSyncedServersRef.current = json;
        }).catch(err => console.warn('Failed to sync server list to backend:', err));
      }
    } catch (e) {}
  }, [servers]);

  useEffect(() => {
    try {
      localStorage.setItem('frigate_active_server_id', activeServerId);
    } catch (e) {}
  }, [activeServerId]);

  // Boot: adopt server-side saved settings so opening the console on another
  // computer shows the same Frigate hosts, BirdNET and notification config.
  // The server only wins when it actually has a saved file (`persisted`);
  // otherwise the local values stand and get pushed up to seed it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [nR, sR] = await Promise.all([
          fetch('/api/notifications/settings').then((r) => r.json()).catch(() => ({})),
          fetch('/api/frigate/servers').then((r) => r.json()).catch(() => ({})),
        ]);
        if (cancelled) return;

        if (nR?.persisted && nR.settings) {
          const merged = { ...DEFAULT_NOTIFICATION_SETTINGS, ...nR.settings };
          lastSyncedNotifRef.current = JSON.stringify(merged);
          setNotificationSettings(merged);
        }

        if (sR?.persisted && Array.isArray(sR.servers) && sR.servers.length > 0) {
          lastSyncedServersRef.current = JSON.stringify(sR.servers);
          setServers(sR.servers);
          setActiveServerId((prev) =>
            sR.servers.some((s: FrigateServerConfig) => s.id === prev) ? prev : sR.servers[0].id,
          );
        }
      } catch (e) {
        // Offline / server unreachable — carry on with local values.
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Synchronize cameras & events from active server
  const handleSyncServerCameras = useCallback(
    async (server?: FrigateServerConfig) => {
      const target = server || activeServer;
      if (!target || target.id === 'no-server') {
        setCameras([]);
        return;
      }

      if (target.isSimulated) {
        if (dummyCamerasEnabled) {
          setCameras(INITIAL_CAMERAS);
          setEvents(INITIAL_EVENTS);
        } else {
          setCameras([]);
        }
        setTelemetry((prev) => ({
          ...prev,
          uptimeFormatted: '4 days, 18 hours, 32 mins',
          isLive: false,
        }));
        return;
      }

      try {
        // 1. Fetch camera configs from real Frigate server
        const configRes = await fetch('/api/frigate/servers/fetch-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: target.url, apiKey: target.apiKey }),
        });
        const configData = await configRes.json();
        if (configData.success && Array.isArray(configData.cameras) && configData.cameras.length > 0) {
          setCameras(configData.cameras);
        }

        // 2. Fetch events from real Frigate server detection engine
        const eventsRes = await fetch('/api/frigate/servers/fetch-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: target.url, apiKey: target.apiKey }),
        });
        const eventsData = await eventsRes.json();
        if (eventsData.success && Array.isArray(eventsData.events) && eventsData.events.length > 0) {
          setEvents(eventsData.events);
        }

        // 3. Fetch real-time system stats (CPU, EdgeTPU inference, memory, storage)
        try {
          const statsRes = await fetch(
            `/api/frigate/stats?serverUrl=${encodeURIComponent(target.url)}${
              target.apiKey ? `&apiKey=${encodeURIComponent(target.apiKey)}` : ''
            }`
          );
          const statsData = await statsRes.json();
          if (statsData.success && statsData.telemetry) {
            setTelemetry({ ...statsData.telemetry, isLive: true });
          }
        } catch (statsErr) {
          console.warn('Could not fetch server stats from Frigate host:', statsErr);
        }

        // 4. Update server status
        setServers((prev) =>
          prev.map((s) =>
            s.id === target.id
              ? {
                  ...s,
                  status: 'connected',
                  detectedCamerasCount: configData.cameras?.length ?? s.detectedCamerasCount,
                  version: configData.version ?? s.version,
                  lastSeen: Date.now(),
                }
              : s
          )
        );
      } catch (err) {
        console.warn('Could not sync with live Frigate server, retaining current buffer:', err);
      }
    },
    [activeServer, dummyCamerasEnabled]
  );

  // Auto-sync cameras & events for the active real server on boot (and
  // whenever the active server changes) — without this, a fresh page load
  // shows whatever `events` initialized to (the hardcoded demo array) until
  // something manually triggers a resync, leaving demo events mixed in
  // indefinitely with real ones pushed in live via MQTT.
  useEffect(() => {
    if (activeServer && !activeServer.isSimulated && activeServer.id !== 'no-server') {
      handleSyncServerCameras(activeServer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerId]);

  // Server selection handler
  const handleSelectServer = (serverId: string) => {
    setActiveServerId(serverId);
    const target = servers.find((s) => s.id === serverId);
    if (target) {
      handleSyncServerCameras(target);
    }
  };

  // Toggle dummy camera option
  const handleToggleDummyCameras = (enabled: boolean) => {
    setDummyCamerasEnabled(enabled);
    if (activeServer.isSimulated) {
      if (enabled) {
        setCameras(INITIAL_CAMERAS);
        setEvents(INITIAL_EVENTS);
      } else {
        setCameras([]);
      }
    }
  };

  // Restore dummy server engine
  const handleRestoreDummyServer = () => {
    setDummyCamerasEnabled(true);
    if (!servers.some((s) => s.id === 'server-simulated')) {
      const updated = [DEFAULT_SERVERS[0], ...servers];
      setServers(updated);
      setActiveServerId('server-simulated');
      setCameras(INITIAL_CAMERAS);
    } else {
      setActiveServerId('server-simulated');
      setCameras(INITIAL_CAMERAS);
    }
  };

  // Dispatch notification to Gmail, Slack, and Discord for detected events
  const dispatchNotificationForEvent = async (event: FrigateEvent) => {
    if (
      !notificationSettings.gmail.enabled &&
      !notificationSettings.slack.enabled &&
      !notificationSettings.discord.enabled
    ) {
      return;
    }

    const filters = notificationSettings.filters;
    if (filters) {
      if (filters.minImportance === 'alert_only' && event.importance !== 'alert') return;
      if (filters.minThreatLevel === 'high_only' && event.threatLevel !== 'high') return;
      if (filters.minThreatLevel === 'medium_high' && event.threatLevel === 'low') return;
      if (filters.targetLabels && filters.targetLabels.length > 0 && !filters.targetLabels.includes(event.label)) {
        return;
      }
      if (filters.selectedCameras && filters.selectedCameras.length > 0 && !filters.selectedCameras.includes(event.camera)) {
        return;
      }
    }

    try {
      const res = await fetch('/api/notifications/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, settings: notificationSettings }),
      });
      const data = await res.json();
      if (data.dispatched && data.dispatched.length > 0) {
        setNotificationToast(
          `Notification dispatched to ${data.dispatched.map((d: string) => d.toUpperCase()).join(', ')} for ${event.label.toUpperCase()}`
        );
        setTimeout(() => setNotificationToast(null), 8000);
      }
    } catch (e) {
      console.warn('Notification dispatch error:', e);
    }
  };

  // Fetch BirdNET sightings
  const handleFetchBirdSightings = useCallback(async () => {
    try {
      const res = await fetch('/api/birds/sightings');
      const data = await res.json();
      if (data.success && Array.isArray(data.sightings)) {
        setBirdSightings(data.sightings);
      }
    } catch (err) {
      console.warn('Failed to fetch bird sightings:', err);
    }
  }, []);

  useEffect(() => {
    handleFetchBirdSightings();
  }, [handleFetchBirdSightings]);

  // Live SSE listener for real-time Frigate events
  useEffect(() => {
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
          } else if (payload.type === 'tide_alert' && payload.summary) {
            setTideAlert(payload.summary);
            setTimeout(() => setTideAlert(null), 15000);
          } else if (payload.type === 'frigate_event' && payload.event) {
            const newEvt: FrigateEvent = payload.event;

            setEvents((prev) => {
              // De-duplicate: If event already exists in the list, update it instead of adding a new one
              const index = prev.findIndex(e => e.id === newEvt.id);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = { ...updated[index], ...newEvt };
                return updated;
              }
              return [newEvt, ...prev];
            });

            setActiveAlarmAlert(
              `LIVE DETECTION: ${newEvt.label.toUpperCase()} on ${newEvt.camera.replace('_', ' ')} (${Math.round(newEvt.score * 100)}%)`
            );
            // Notifications are now handled server-side in the background
            // dispatchNotificationForEvent(newEvt);
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      if (es) es.close();
    };
  }, [notificationSettings]);

  // Periodic MQTT status fallback (for environments where SSE might be unstable)
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/frigate/mqtt/status');
        const data = await res.json();
        if (data.success && data.status) {
          setMqttStatus(data.status);
        }
      } catch (_) {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Periodic background telemetry polling for connected Frigate server (Port 5000)
  useEffect(() => {
    if (!activeServer || activeServer.isSimulated || !activeServer.url) return;

    const interval = setInterval(async () => {
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
    }, 10000);

    return () => clearInterval(interval);
  }, [activeServer]);

  // Add new server handler
  const handleAddServer = (newServer: FrigateServerConfig) => {
    setServers((prev) => [...prev, newServer]);
    setActiveServerId(newServer.id);
    handleSyncServerCameras(newServer);
  };

  // Delete server handler (can delete any server including the dummy simulated server)
  const handleDeleteServer = (serverId: string) => {
    const nextServers = servers.filter((s) => s.id !== serverId);
    setServers(nextServers);
    if (serverId === 'server-simulated') {
      setDummyCamerasEnabled(false);
    }
    if (activeServerId === serverId) {
      if (nextServers.length > 0) {
        setActiveServerId(nextServers[0].id);
        handleSyncServerCameras(nextServers[0]);
      } else {
        setActiveServerId('');
        setCameras([]);
      }
    }
  };

  // Update existing server handler (e.g. MQTT credentials updated)
  const handleUpdateServer = (updatedServer: FrigateServerConfig) => {
    setServers((prev) => prev.map((s) => (s.id === updatedServer.id ? updatedServer : s)));
    if (activeServerId === updatedServer.id) {
      handleSyncServerCameras(updatedServer);
    }
  };

  // Unreviewed count for badge
  const unreviewedCount = events.filter((e) => !e.reviewed).length;

  // Toggle AI Detect
  const handleToggleDetect = (cameraId: string) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === cameraId ? { ...c, detectEnabled: !c.detectEnabled } : c))
    );
  };

  // Toggle Record
  const handleToggleRecord = (cameraId: string) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === cameraId ? { ...c, recordEnabled: !c.recordEnabled } : c))
    );
  };

  // Switch Stream Type (main vs sub)
  const handleSwitchStreamType = (cameraId: string, type: 'main' | 'sub') => {
    setCameras((prev) =>
      prev.map((c) => (c.id === cameraId ? { ...c, streamType: type } : c))
    );
    if (selectedCameraForDetail && selectedCameraForDetail.id === cameraId) {
      setSelectedCameraForDetail((prev) => (prev ? { ...prev, streamType: type } : null));
    }
  };

  // Mark event reviewed
  const handleMarkReviewed = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, reviewed: true } : e))
    );
  };

  // Mark all reviewed
  const handleMarkAllReviewed = () => {
    setEvents((prev) => prev.map((e) => ({ ...e, reviewed: true })));
  };

  // Delete event
  const handleDeleteEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  // Clear all events
  const handleClearAllEvents = () => {
    setEvents([]);
  };

  // Update event with AI summary
  const handleUpdateEventAiSummary = (
    eventId: string,
    summary: string,
    threatLevel: 'low' | 'medium' | 'high',
    recommendedAction: string
  ) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              summary,
              threatLevel,
              recommendedAction,
              isAiAnalyzed: true,
            }
          : e
      )
    );
  };

  // Save Zones & Masks from Studio
  const handleSaveZones = (
    cameraId: string,
    zones: ZonePolygon[],
    motionMasks: MotionMask[]
  ) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === cameraId ? { ...c, zones, motionMasks } : c))
    );
  };

  // Restart Frigate Engine simulation
  const handleRestartEngine = () => {
    setTelemetry((prev) => ({
      ...prev,
      uptimeFormatted: '0 days, 0 hours, 1 min',
      cpuPercent: 12.4,
      isLive: false,
    }));
  };

  // Trigger simulated alarm event
  const handleTriggerSimulatedAlarm = () => {
    const newEvent: FrigateEvent = {
      id: `evt-${Date.now().toString().slice(-4)}`,
      camera: 'front_porch',
      label: 'person',
      score: 0.95,
      startTime: Date.now(),
      duration: 12,
      zones: ['doorstep_package_zone'],
      reviewed: false,
      hasSnapshot: true,
      hasClip: true,
      importance: 'alert',
      summary: 'SIMULATED INTRUDER ALERT: Unidentified individual stepped into doorstep threshold.',
      threatLevel: 'high',
      recommendedAction: 'Verify front door snapshot and activate external floodlight.',
      isAiAnalyzed: true,
      box: { x: 0.35, y: 0.35, width: 0.28, height: 0.55 },
    };

    setEvents((prev) => [newEvent, ...prev]);
    setActiveAlarmAlert('SECURITY ALERT TRIGGERED: Person detected in Front Porch Doorstep Zone!');
    dispatchNotificationForEvent(newEvent);
    setTimeout(() => setActiveAlarmAlert(null), 8000);
  };

  const displayedCameras = dummyCamerasEnabled || !activeServer.isSimulated ? cameras : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-white selection:text-slate-950">
      {/* Top Navigation Bar */}
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
        onToggleTheme={handleToggleTheme}
        onOpenHostModal={() => setIsHostModalOpen(true)}
        onOpenAiSearch={() => setIsAiSearchModalOpen(true)}
        onTriggerSimulatedAlarm={handleTriggerSimulatedAlarm}
        authEnabled={authEnabled}
        onLogout={onLogout}
      />

      {/* Tide Alert Toast Banner */}
      {tideAlert && (
        <div className="bg-cyan-950/90 border-b border-cyan-500/50 text-white px-6 py-3 shadow-2xl flex items-center text-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-3 max-w-7xl mx-auto w-full">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span className="font-black tracking-wider uppercase text-cyan-100">🌊 {tideAlert}</span>
            <button
              onClick={() => {
                setActiveTab('tides');
                setTideAlert(null);
              }}
              className="ml-auto underline uppercase tracking-widest text-[11px] font-bold text-white hover:text-cyan-200"
            >
              View Tides →
            </button>
            <button
              onClick={() => setTideAlert(null)}
              className="ml-4 p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Emergency Alarm Toast Banner */}
      {activeAlarmAlert && (
        <div className="bg-red-950/90 border-b border-red-500/50 text-white px-6 py-3 shadow-2xl flex items-center justify-between text-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-3 max-w-7xl mx-auto w-full">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="font-black tracking-wider uppercase text-red-200">{activeAlarmAlert}</span>
            <button
              onClick={() => setActiveTab('events')}
              className="ml-auto underline uppercase tracking-widest text-[11px] font-bold text-white hover:text-red-200"
            >
              Review Detection →
            </button>
            <button
              onClick={() => setActiveAlarmAlert(null)}
              className="ml-4 p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Outbound Notification Toast Banner */}
      {notificationToast && (
        <div className="bg-slate-900/90 border-b border-blue-500/40 text-white px-6 py-2.5 shadow-2xl flex items-center justify-between text-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-3 max-w-7xl mx-auto w-full">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
            <span className="tracking-wider uppercase text-blue-200 font-bold">{notificationToast}</span>
            <button
              onClick={() => setNotificationToast(null)}
              className="ml-auto p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'live' && (
          <LiveGrid
            cameras={displayedCameras}
            activeServerName={activeServer.name}
            isLiveHostConnected={!activeServer.isSimulated && activeServer.status === 'connected'}
            telemetry={telemetry}
            onSelectCamera={(cam) => setSelectedCameraForDetail(cam)}
            onToggleDetect={handleToggleDetect}
            onToggleRecord={handleToggleRecord}
            onResyncStreams={() => handleSyncServerCameras(activeServer)}
            onOpenHostModal={() => setIsHostModalOpen(true)}
          />
        )}

        {activeTab === 'events' && (
          <EventsReview
            events={events}
            cameras={displayedCameras}
            onMarkReviewed={handleMarkReviewed}
            onMarkAllReviewed={handleMarkAllReviewed}
            onClearAllEvents={handleClearAllEvents}
            onDeleteEvent={handleDeleteEvent}
            onUpdateEventAiSummary={handleUpdateEventAiSummary}
            onRefreshEvents={() => handleSyncServerCameras(activeServer)}
            isLiveServerConnected={!activeServer.isSimulated}
            mqttStatus={mqttStatus}
            onOpenHostModal={() => setIsHostModalOpen(true)}
          />
        )}

        {activeTab === 'birds' && (
          <BirdSightingsView
            sightings={birdSightings}
            config={notificationSettings.birdnet}
            onRefresh={handleFetchBirdSightings}
            onClear={() => {
              fetch('/api/birds/clear', { method: 'POST' }).then(() => setBirdSightings([]));
            }}
          />
        )}

        {activeTab === 'tides' && (
          <TideView
            config={notificationSettings.tides}
            onGoToSettings={() => setActiveTab('notifications')}
          />
        )}

        {activeTab === 'flights' && (
          <FlightsView
            config={notificationSettings.flights}
            onGoToSettings={() => setActiveTab('notifications')}
          />
        )}

        {activeTab === 'weather' && (
          <WeatherView
            config={notificationSettings.weather}
            onGoToSettings={() => setActiveTab('notifications')}
          />
        )}

        {activeTab === 'zones' && (
          <ZoneEditor cameras={displayedCameras} onSaveZones={handleSaveZones} />
        )}

        {activeTab === 'config' && (
          <ConfigStudio onRestartEngine={handleRestartEngine} />
        )}

        {activeTab === 'system' && (
          <SystemTelemetry
            telemetry={telemetry}
            cameras={displayedCameras}
            theme={theme}
            onSetTheme={setTheme}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationSettingsView
            settings={notificationSettings}
            onUpdateSettings={setNotificationSettings}
            availableCameras={displayedCameras.map((c) => ({ id: c.id, name: c.name }))}
          />
        )}

        {/* Editorial Footer */}
        <footer className="pt-10 pb-6 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 border-t border-slate-800 mt-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            Connected: <strong className="text-white font-bold">{activeServer.name.toUpperCase()}</strong>{' '}
            ({activeServer.isSimulated ? 'Internal Simulator' : activeServer.url || 'No active endpoint'})
          </div>
          <div className="font-mono text-slate-400">Coral EdgeTPU /dev/bus/usb/001/004 • Detection Engine Active</div>
        </footer>
      </main>

      {/* Camera Fullscreen Detail Modal */}
      {selectedCameraForDetail && (
        <CameraDetailModal
          camera={selectedCameraForDetail}
          onClose={() => setSelectedCameraForDetail(null)}
          onSwitchStreamType={handleSwitchStreamType}
        />
      )}

      {/* Multi-Server & MQTT Manager Modal */}
      <HostConnectorModal
        isOpen={isHostModalOpen}
        onClose={() => setIsHostModalOpen(false)}
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onAddServer={handleAddServer}
        onDeleteServer={handleDeleteServer}
        onUpdateServer={handleUpdateServer}
        onSyncServerCameras={handleSyncServerCameras}
        notificationSettings={notificationSettings}
        onUpdateNotificationSettings={setNotificationSettings}
        dummyCamerasEnabled={dummyCamerasEnabled}
        onToggleDummyCameras={handleToggleDummyCameras}
        onRestoreDummyServer={handleRestoreDummyServer}
        availableCameras={cameras.map((c) => ({ id: c.id, name: c.name }))}
      />

      {/* Gemini AI Natural Language Search Modal */}
      <GeminiSearchModal
        isOpen={isAiSearchModalOpen}
        onClose={() => setIsAiSearchModalOpen(false)}
        events={events}
        onSelectEvent={(evt) => {
          setActiveTab('events');
        }}
      />
    </div>
  );
}

export default function App() {
  // 'checking' avoids a flash of the login screen (or the full dashboard)
  // before we actually know whether auth is on and whether this browser
  // already has a valid session cookie.
  const [authState, setAuthState] = useState<'checking' | 'needs-login' | 'ready'>('checking');
  const [authEnabled, setAuthEnabled] = useState(false);

  const checkAuthStatus = () => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        setAuthEnabled(Boolean(data.authEnabled));
        setAuthState(data.authenticated ? 'ready' : 'needs-login');
      })
      .catch(() => {
        // Server unreachable — nothing meaningful to gate on yet, but don't
        // get stuck on the spinner forever either.
        setAuthState('needs-login');
      });
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => setAuthState('needs-login'));
  };

  if (authState === 'checking') {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (authState === 'needs-login') {
    return <LoginView onSuccess={checkAuthStatus} />;
  }

  return <Dashboard authEnabled={authEnabled} onLogout={handleLogout} />;
}
