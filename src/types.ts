export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  id: string;
  label: string;
  score: number;
  box: BoundingBox;
  stationary: boolean;
  currentZone?: string;
}

export interface ZonePolygon {
  id: string;
  name: string;
  color: string;
  points: [number, number][];
  objects: string[];
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
  zones: ZonePolygon[];
  motionMasks: any[];
  thumbnailTheme: 'driveway' | 'front_porch' | 'backyard' | 'street' | 'garage' | 'side_gate';
  mjpegStreamUrl?: string;
  liveImageUrl?: string;
  frigate_url?: string;
}

export interface FrigateEvent {
  id: string;
  camera: string;
  label: string;
  score: number;
  startTime: number;
  duration: number;
  zones: string[];
  reviewed: boolean;
  hasSnapshot: boolean;
  hasClip: boolean;
  importance: 'alert' | 'detection';
  box: BoundingBox;
  snapshotUrl?: string;
  clipUrl?: string;
}

export interface MqttStatusInfo {
  connected: boolean;
  brokerUrl: string;
  topicPrefix: string;
  messageCount: number;
}

export interface FrigateServerConfig {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  isSimulated?: boolean;
  status: 'connected' | 'disconnected' | 'error';
  mqtt: { enabled: boolean; brokerHost: string; port: number };
}

export interface SystemTelemetryData {
  uptimeFormatted: string;
  version: string;
  coral: { inferenceSpeedMs: number; temperatureC: number; detectionFps: number; };
  storage: { recordingsUsedGb: number; recordingsTotalGb: number; };
  cpuPercent: number;
  isLive: boolean;
}

export interface NotificationSettings {
  gmail: { enabled: boolean; recipientEmail: string; smtpUser?: string; smtpPassword?: string; };
  slack: { enabled: boolean; webhookUrl: string; };
  discord: { enabled: boolean; webhookUrl: string; };
  filters: { minImportance: string; minThreatLevel: string; targetLabels: string[]; selectedCameras: string[]; ignoreParkedCars?: boolean; };
  birdnet?: { enabled: boolean; brokerHost: string; port: number; topic: string; serverUrl?: string; liveAudioUrl?: string; };
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
  funFact?: string;
}

export type ActiveTab = 'live' | 'events' | 'birds' | 'zones' | 'config' | 'system' | 'notifications';
export type AppTheme = 'midnight' | 'slate-grey';
