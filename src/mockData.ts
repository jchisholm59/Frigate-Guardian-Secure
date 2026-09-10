import { CameraStream, FrigateEvent, SystemTelemetryData } from './types';

export const INITIAL_CAMERAS: CameraStream[] = [
  {
    id: 'front_porch',
    name: 'Front Porch',
    location: 'Exterior',
    resolution: '1920x1080',
    fps: 30,
    bitrateKbps: 2500,
    status: 'online',
    streamType: 'main',
    detectEnabled: true,
    recordEnabled: true,
    audioEnabled: true,
    ptzCapable: false,
    zones: [],
    motionMasks: [],
    detectedObjects: [],
    thumbnailTheme: 'front_porch'
  }
];

export const INITIAL_EVENTS: FrigateEvent[] = [];

export const INITIAL_TELEMETRY: SystemTelemetryData = {
  uptimeFormatted: '0 days, 0 hours, 0 mins',
  version: '1.0.0',
  coral: { inferenceSpeedMs: 0, temperatureC: 0, detectionFps: 0 },
  storage: { recordingsUsedGb: 0, recordingsTotalGb: 100 },
  cpuPercent: 0
};
