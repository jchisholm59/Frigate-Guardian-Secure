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

export interface NotificationFilterConfig {
  minImportance: 'all' | 'alert_only';
  minThreatLevel: 'all' | 'medium_high' | 'high_only';
  targetLabels: string[];
  selectedCameras: string[];
  cooldownSeconds: number;
  ignoreParkedCars?: boolean;
}

export interface NotificationSettings {
  gmail: GmailNotificationConfig;
  slack: SlackNotificationConfig;
  discord: DiscordNotificationConfig;
  filters: NotificationFilterConfig;
  birdnet?: BirdNetConfig;
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

export type ActiveTab = 'live' | 'events' | 'birds' | 'zones' | 'config' | 'system' | 'notifications';

export type AppTheme = 'midnight' | 'slate-grey';

