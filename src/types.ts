export interface BoundingBox {
  x: number; // 0 to 1 normalized
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  id: string;
  label: 'person' | 'car' | 'dog' | 'cat' | 'package' | 'bicycle' | 'motorcycle' | string;
  score: number; // 0.0 to 1.0
  box: BoundingBox;
  currentZone?: string;
  stationary: boolean;
  trajectory?: { x: number; y: number }[];
  color?: string;
}

export interface ZonePolygon {
  id: string;
  name: string;
  color: string;
  points: [number, number][]; // [x, y] normalized 0..1
  objects: string[]; // e.g. ['person', 'car', 'package']
  inertia?: number;
  loiteringTime?: number;
}

export interface MotionMask {
  id: string;
  name: string;
  points: [number, number][]; // normalized
}

export interface CameraStream {
  id: string;
  name: string;
  location: string;
  resolution: string;
  fps: number;
  bitrateKbps: number;
  status: 'online' | 'reconnecting' | 'offline';
  streamType: 'main' | 'sub';
  detectEnabled: boolean;
  recordEnabled: boolean;
  audioEnabled: boolean;
  ptzCapable: boolean;
  zones: ZonePolygon[];
  motionMasks: MotionMask[];
  thumbnailTheme: 'driveway' | 'front_porch' | 'backyard' | 'street' | 'garage' | 'side_gate';
  isLiveStream?: boolean;
  liveStreamUrl?: string;
  liveImageUrl?: string;
  mjpegStreamUrl?: string;
  rtspUrl?: string;
  go2rtcUrl?: string;
  streamingMode?: 'mjpeg' | 'snapshot' | 'rtsp';
  serverId?: string;
  frigate_url?: string;
}

export interface FrigateEvent {
  id: string;
  camera: string;
  label: 'person' | 'car' | 'dog' | 'cat' | 'package' | 'bicycle' | string;
  score: number;
  startTime: number;
  endTime?: number;
  duration: number; // seconds
  zones: string[];
  stationary?: boolean;
  reviewed: boolean;
  hasSnapshot: boolean;
  hasClip: boolean;
  importance: 'alert' | 'detection';
  summary?: string;
  threatLevel?: 'low' | 'medium' | 'high';
  recommendedAction?: string;
  isAiAnalyzed?: boolean;
  box: BoundingBox;
  snapshotUrl?: string;
  clipUrl?: string;
  thumbnailUrl?: string;
  serverId?: string;
  source?: 'mqtt' | 'rest' | 'simulated';
}

export interface MqttStatusInfo {
  connected: boolean;
  connecting?: boolean;
  brokerUrl: string;
  topicPrefix: string;
  lastReceivedAt: number | null;
  messageCount: number;
  error: string | null;
}

export interface MqttCredentials {
  enabled: boolean;
  brokerHost: string;
  port: number;
  protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss';
  topicPrefix: string;
  username?: string;
  password?: string;
  clientId?: string;
  connected?: boolean;
}

export interface FrigateServerConfig {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  isDefault?: boolean;
  isSimulated?: boolean;
  status: 'connected' | 'disconnected' | 'probing' | 'error';
  lastSeen?: number;
  version?: string;
  detectedCamerasCount?: number;
  rtspPort?: number;
  go2rtcPort?: number;
  streamingMode?: 'mjpeg' | 'snapshot' | 'rtsp';
  mqtt: MqttCredentials;
}

export interface CoralTelemetry {
  inferenceSpeedMs: number;
  temperatureC: number;
  detectionFps: number;
  status: 'optimal' | 'throttled' | 'offline';
  deviceType: string;
}

export interface StorageTelemetry {
  recordingsUsedGb: number;
  recordingsTotalGb: number;
  clipsUsedGb: number;
  clipsTotalGb: number;
  shmUsedMb: number;
  shmTotalMb: number;
}

export interface SystemTelemetryData {
  uptimeFormatted: string;
  version: string;
  coral: CoralTelemetry;
  storage: StorageTelemetry;
  cpuPercent: number;
  ramPercent: number;
  activeEventsCount: number;
  totalEventsToday: number;
  isLive: boolean;
}

export interface GmailNotificationConfig {
  enabled: boolean;
  recipientEmail: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  senderName?: string;
}

export interface SlackNotificationConfig {
  enabled: boolean;
  webhookUrl: string;
  channel?: string;
  username?: string;
  includeThumbnail?: boolean;
}

export interface DiscordNotificationConfig {
  enabled: boolean;
  webhookUrl: string;
  botUsername?: string;
  avatarUrl?: string;
  includeThumbnail?: boolean;
}

export interface ExclusionZone {
  id: string;
  name: string;
  points: [number, number][]; // [x, y] normalized 0..1
}

export interface NotificationFilterConfig {
  minImportance: 'all' | 'alert_only';
  minThreatLevel: 'all' | 'medium_high' | 'high_only';
  targetLabels: string[];
  selectedCameras: string[];
  /** An empty selectedCameras[] means "no filter — every camera notifies",
   *  so muting the very last camera (which empties the array) can't be
   *  distinguished from never having filtered at all. This flag exists
   *  purely to represent that "everything muted" state unambiguously. */
  allCamerasMuted?: boolean;
  cooldownSeconds: number;
  ignoreParkedCars?: boolean;
  /** Per-camera regions where a detection's box centroid falling inside
   *  silently skips the notification, regardless of what Frigate itself
   *  thinks about the object (its own `stationary` flag can be unreliable
   *  for parked cars under changing light/shadow). Keyed by camera id. */
  exclusionZones?: Record<string, ExclusionZone[]>;
}

export interface NotificationSettings {
  gmail: GmailNotificationConfig;
  slack: SlackNotificationConfig;
  discord: DiscordNotificationConfig;
  filters: NotificationFilterConfig;
  birdnet?: BirdNetConfig;
  tides?: TidalConfig;
  flights?: FlightsConfig;
  weather?: WeatherConfig;
}

// --- Flights (PiAware / dump1090-fa ADS-B receiver) ---

export interface FlightsConfig {
  enabled: boolean;
  /** Receiver IP/host (e.g. "192.168.1.x") or a full aircraft.json URL for non-default installs */
  piawareUrl: string;
  homeLat: number;
  homeLon: number;
  /** Optional — free OpenSky Network API client credentials, adds departure/arrival times */
  openskyClientId?: string;
  openskyClientSecret?: string;
}

export interface AircraftPosition {
  hex: string;
  /** Trimmed callsign, or null if the aircraft hasn't broadcast one yet */
  flight: string | null;
  lat: number;
  lon: number;
  /** Feet, or null if unknown */
  altitude: number | null;
  onGround: boolean;
  /** Knots, or null if unknown */
  groundSpeed: number | null;
  /** Heading in degrees, or null if unknown */
  track: number | null;
  squawk: string | null;
  distanceNm: number;
  /** Bearing in degrees from home to the aircraft */
  bearing: number;
  /** Seconds since the last message from this aircraft */
  seenSec: number;
  /** Seconds since the last position update */
  seenPosSec: number;
}

export interface FlightDetail {
  success: boolean;
  aircraft?: {
    registration?: string;
    type?: string;
    icaoType?: string;
    manufacturer?: string;
  };
  route?: {
    airline?: string;
    originName?: string;
    originCity?: string;
    originIata?: string;
    destinationName?: string;
    destinationCity?: string;
    destinationIata?: string;
    /** Unix ms — only present when OpenSky credentials are configured */
    departureTime?: number;
    arrivalTime?: number;
  };
  photo?: {
    url: string;
    photographer?: string;
    link?: string;
  };
  error?: string;
}

// --- Weather (Open-Meteo) ---

export interface WeatherConfig {
  enabled: boolean;
  homeLat: number;
  homeLon: number;
}

export interface WeatherCurrent {
  time: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPct: number;
  precipitationMm: number;
  weatherCode: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  pressureHpa: number;
  isDay: boolean;
}

export interface WeatherDailyEntry {
  date: string;
  weatherCode: number;
  highC: number;
  lowC: number;
  precipProbabilityPct: number;
  windSpeedMaxKmh: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherReadout {
  success: boolean;
  current?: WeatherCurrent;
  daily?: WeatherDailyEntry[];
  timezone?: string;
  fetchedAt?: number;
  error?: string;
}

// --- Tides (DFO / Canadian Hydrographic Service) ---

export interface TidalStation {
  /** DFO IWLS station id (Mongo-style hash) */
  id: string;
  /** Human-facing 5-digit CHS station code, e.g. "00490" */
  code: string;
  /** Official station name from DFO */
  name: string;
  latitude: number;
  longitude: number;
  province?: string;
}

export interface TidalAlertConfig {
  enabled: boolean;
  /** Which notification channels tide alerts go out on */
  channels: ('gmail' | 'slack' | 'discord')[];
  /** Fire this many minutes before the predicted event */
  minutesBefore: number;
  /** Which events trigger an alert */
  events: ('high' | 'low')[];
}

export interface TidalConfig {
  enabled: boolean;
  stations: TidalStation[];
  units: 'm' | 'ft';
  refreshIntervalMinutes: number;
  alerts: TidalAlertConfig;
}

export interface TidalDataPoint {
  /** ISO-8601 UTC timestamp */
  eventDate: string;
  /** Water level in metres (chart datum) */
  value: number;
}

export interface TidalExtreme extends TidalDataPoint {
  type: 'high' | 'low';
}

export interface SunMoonInfo {
  sunrise: string | null;
  sunset: string | null;
  /** 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter */
  moonPhase: number;
  moonPhaseName: string;
  /** 0..1 fraction of the moon's disc that is lit */
  moonIllumination: number;
}

export interface TidalStationReadout {
  success: boolean;
  station: TidalStation;
  predictions: TidalDataPoint[];
  highLow: TidalExtreme[];
  fetchedAt: number;
  error?: string;
}

export interface BirdNetConfig {
  enabled: boolean;
  brokerHost: string;
  port: number;
  topic: string;
  serverUrl?: string; // e.g. http://192.168.2.210:8080
  liveAudioUrl?: string; // e.g. rtsp://192.168.2.150:554/live
  username?: string;
  password?: string;
  sendDailyAlerts?: boolean;
  /** Which channels get the daily-first-detection alert. Unset/empty means
   *  "whatever's globally enabled" (matches pre-existing behavior). */
  alertChannels?: ('gmail' | 'slack' | 'discord')[];
}

export interface BirdSighting {
  id: string;
  commonName: string;
  scientificName: string;
  confidence: number;
  timestamp: number;
  sourceNode: string;
  imageUrl?: string;
  audioUrl?: string;
  wikiUrl?: string;
  funFact?: string;
  isAiAnalyzed?: boolean;
}

export interface NotificationLog {
  id: string;
  timestamp: number;
  channel: 'gmail' | 'slack' | 'discord';
  status: 'sent' | 'failed' | 'simulated';
  eventId?: string;
  camera: string;
  label: string;
  message: string;
  details?: string;
}

export type ActiveTab = 'live' | 'events' | 'birds' | 'tides' | 'flights' | 'weather' | 'zones' | 'config' | 'system' | 'notifications';

export type AppTheme = 'midnight' | 'slate-grey';

