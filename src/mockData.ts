import { CameraStream, FrigateEvent, SystemTelemetryData } from './types';

export const INITIAL_CAMERAS: CameraStream[] = [
  {
    id: 'driveway',
    name: 'Driveway South',
    location: 'Exterior - Front Yard',
    resolution: '2560x1440',
    fps: 25,
    bitrateKbps: 3420,
    status: 'online',
    streamType: 'main',
    detectEnabled: true,
    recordEnabled: true,
    audioEnabled: false,
    ptzCapable: true,
    thumbnailTheme: 'driveway',
    frigate_url: 'http://localhost:5000',
    zones: [
      {
        id: 'z-driveway-park',
        name: 'driveway_parking',
        color: '#38bdf8',
        points: [
          [0.15, 0.45],
          [0.82, 0.48],
          [0.92, 0.95],
          [0.08, 0.92],
        ],
        objects: ['car', 'person', 'bicycle'],
      },
      {
        id: 'z-driveway-sidewalk',
        name: 'public_sidewalk',
        color: '#eab308',
        points: [
          [0.05, 0.25],
          [0.95, 0.28],
          [0.95, 0.42],
          [0.05, 0.40],
        ],
        objects: ['person', 'dog'],
      },
    ],
    motionMasks: [
      {
        id: 'm-driveway-tree',
        name: 'tree_foliage_mask',
        points: [
          [0.0, 0.0],
          [0.35, 0.0],
          [0.3, 0.28],
          [0.0, 0.32],
        ],
      },
    ],
  },
  {
    id: 'front_porch',
    name: 'Front Porch Doorbell',
    location: 'Exterior - Main Entrance',
    resolution: '1920x1080',
    fps: 30,
    bitrateKbps: 2850,
    status: 'online',
    streamType: 'main',
    detectEnabled: true,
    recordEnabled: true,
    audioEnabled: true,
    ptzCapable: false,
    thumbnailTheme: 'front_porch',
    frigate_url: 'http://localhost:5000',
    zones: [
      {
        id: 'z-porch-doorstep',
        name: 'doorstep_package_zone',
        color: '#10b981',
        points: [
          [0.28, 0.52],
          [0.72, 0.52],
          [0.82, 0.96],
          [0.18, 0.96],
        ],
        objects: ['package', 'person'],
      },
    ],
    motionMasks: [],
  },
  {
    id: 'backyard',
    name: 'Backyard Patio',
    location: 'Exterior - Garden & Deck',
    resolution: '2560x1440',
    fps: 20,
    bitrateKbps: 2900,
    status: 'online',
    streamType: 'main',
    detectEnabled: true,
    recordEnabled: true,
    audioEnabled: false,
    ptzCapable: true,
    thumbnailTheme: 'backyard',
    frigate_url: 'http://localhost:5000',
    zones: [
      {
        id: 'z-backyard-deck',
        name: 'patio_deck',
        color: '#f43f5e',
        points: [
          [0.12, 0.60],
          [0.88, 0.62],
          [0.96, 0.98],
          [0.04, 0.98],
        ],
        objects: ['person', 'dog', 'cat'],
      },
    ],
    motionMasks: [
      {
        id: 'm-backyard-hedge',
        name: 'wind_hedge_mask',
        points: [
          [0.6, 0.1],
          [0.99, 0.1],
          [0.99, 0.45],
          [0.65, 0.4],
        ],
      },
    ],
  },
  {
    id: 'street_front',
    name: 'Street Frontage',
    location: 'Exterior - Road & Curb',
    resolution: '3840x2160',
    fps: 25,
    bitrateKbps: 5120,
    status: 'online',
    streamType: 'main',
    detectEnabled: true,
    recordEnabled: true,
    audioEnabled: false,
    ptzCapable: true,
    thumbnailTheme: 'street',
    frigate_url: 'http://localhost:5000',
    zones: [
      {
        id: 'z-street-curb',
        name: 'curb_parking',
        color: '#8b5cf6',
        points: [
          [0.02, 0.55],
          [0.98, 0.52],
          [0.98, 0.88],
          [0.02, 0.92],
        ],
        objects: ['car', 'bicycle'],
      },
    ],
    motionMasks: [],
  },
  {
    id: 'garage_interior',
    name: 'Garage Workshop',
    location: 'Interior - Bay 1 & 2',
    resolution: '1920x1080',
    fps: 20,
    bitrateKbps: 2100,
    status: 'online',
    streamType: 'sub',
    detectEnabled: true,
    recordEnabled: true,
    audioEnabled: false,
    ptzCapable: false,
    thumbnailTheme: 'garage',
    frigate_url: 'http://localhost:5000',
    zones: [
      {
        id: 'z-garage-car-bay',
        name: 'vehicle_bay',
        color: '#06b6d4',
        points: [
          [0.2, 0.4],
          [0.85, 0.4],
          [0.92, 0.92],
          [0.15, 0.92],
        ],
        objects: ['car', 'person'],
      },
    ],
    motionMasks: [],
  },
  {
    id: 'side_gate',
    name: 'North Perimeter Gate',
    location: 'Exterior - Side Alleyway',
    resolution: '1920x1080',
    fps: 15,
    bitrateKbps: 1850,
    status: 'online',
    streamType: 'main',
    detectEnabled: true,
    recordEnabled: true,
    audioEnabled: false,
    ptzCapable: false,
    thumbnailTheme: 'side_gate',
    frigate_url: 'http://localhost:5000',
    zones: [
      {
        id: 'z-side-gate-path',
        name: 'side_pathway',
        color: '#ec4899',
        points: [
          [0.25, 0.35],
          [0.75, 0.35],
          [0.85, 0.95],
          [0.15, 0.95],
        ],
        objects: ['person', 'cat'],
      },
    ],
    motionMasks: [],
  },
];

const now = Date.now();
const min = 60 * 1000;
const hr = 60 * min;

export const INITIAL_EVENTS: FrigateEvent[] = [
  {
    id: 'evt-1094',
    camera: 'front_porch',
    label: 'package',
    score: 0.93,
    startTime: now - 14 * min,
    duration: 180,
    zones: ['doorstep_package_zone'],
    reviewed: false,
    hasSnapshot: true,
    hasClip: true,
    importance: 'alert',
    summary: 'Cardboard courier parcel left directly in front of doorstep threshold.',
    threatLevel: 'low',
    recommendedAction: 'Parcel secure on front porch doorstep.',
    isAiAnalyzed: true,
    box: { x: 0.42, y: 0.68, width: 0.16, height: 0.18 },
  },
  {
    id: 'evt-1093',
    camera: 'front_porch',
    label: 'person',
    score: 0.89,
    startTime: now - 16 * min,
    duration: 38,
    zones: ['doorstep_package_zone'],
    reviewed: false,
    hasSnapshot: true,
    hasClip: true,
    importance: 'alert',
    summary: 'Courier wearing vest approached doorstep, deposited package, and returned to vehicle.',
    threatLevel: 'low',
    recommendedAction: 'Normal expected delivery service.',
    isAiAnalyzed: true,
    box: { x: 0.38, y: 0.32, width: 0.24, height: 0.58 },
  },
  {
    id: 'evt-1092',
    camera: 'driveway',
    label: 'car',
    score: 0.96,
    startTime: now - 42 * min,
    duration: 110,
    zones: ['driveway_parking'],
    reviewed: true,
    hasSnapshot: true,
    hasClip: true,
    importance: 'detection',
    summary: 'White delivery van reversed into driveway apron, lingered 70 seconds, departed.',
    threatLevel: 'low',
    recommendedAction: 'Delivery van routine stop.',
    isAiAnalyzed: true,
    box: { x: 0.28, y: 0.48, width: 0.44, height: 0.36 },
  },
  {
    id: 'evt-1091',
    camera: 'side_gate',
    label: 'person',
    score: 0.82,
    startTime: now - 2 * hr - 15 * min,
    duration: 24,
    zones: ['side_pathway'],
    reviewed: false,
    hasSnapshot: true,
    hasClip: true,
    importance: 'alert',
    summary: 'Unknown individual peered briefly over North perimeter gate before turning back toward sidewalk.',
    threatLevel: 'medium',
    recommendedAction: 'Verify perimeter latch and review high-res night vision recording.',
    isAiAnalyzed: true,
    box: { x: 0.34, y: 0.38, width: 0.28, height: 0.52 },
  },
  {
    id: 'evt-1090',
    camera: 'backyard',
    label: 'dog',
    score: 0.88,
    startTime: now - 3 * hr - 10 * min,
    duration: 210,
    zones: ['patio_deck'],
    reviewed: true,
    hasSnapshot: true,
    hasClip: true,
    importance: 'detection',
    summary: 'Golden retriever traversed lawn and rested on wooden deck patio.',
    threatLevel: 'low',
    recommendedAction: 'Pet activity within safe boundary.',
    isAiAnalyzed: true,
    box: { x: 0.48, y: 0.62, width: 0.22, height: 0.24 },
  },
  {
    id: 'evt-1089',
    camera: 'street_front',
    label: 'bicycle',
    score: 0.78,
    startTime: now - 4 * hr - 45 * min,
    duration: 16,
    zones: ['curb_parking'],
    reviewed: true,
    hasSnapshot: true,
    hasClip: true,
    importance: 'detection',
    summary: 'Cyclist passed along curb lane heading West at moderate velocity.',
    threatLevel: 'low',
    recommendedAction: 'Pass-through traffic, no alert needed.',
    isAiAnalyzed: false,
    box: { x: 0.62, y: 0.54, width: 0.18, height: 0.28 },
  },
  {
    id: 'evt-1088',
    camera: 'driveway',
    label: 'person',
    score: 0.91,
    startTime: now - 7 * hr,
    duration: 45,
    zones: ['driveway_parking'],
    reviewed: true,
    hasSnapshot: true,
    hasClip: true,
    importance: 'alert',
    summary: 'Resident walked from main garage to retrieve morning mail.',
    threatLevel: 'low',
    recommendedAction: 'Recognized family routine.',
    isAiAnalyzed: true,
    box: { x: 0.35, y: 0.42, width: 0.2, height: 0.5 },
  },
];

export const INITIAL_TELEMETRY: SystemTelemetryData = {
  uptimeFormatted: '18 days, 4 hours, 22 mins',
  version: 'Frigate 0.14.1-e0e84b8',
  coral: {
    inferenceSpeedMs: 8.35,
    temperatureC: 48.2,
    detectionFps: 42.1,
    status: 'optimal',
    deviceType: 'Google Coral USB Accelerator (EdgeTPU)',
  },
  storage: {
    recordingsUsedGb: 1245.4,
    recordingsTotalGb: 2000.0,
    clipsUsedGb: 82.3,
    clipsTotalGb: 500.0,
    shmUsedMb: 284,
    shmTotalMb: 1024,
  },
  cpuPercent: 24.6,
  ramPercent: 38.2,
  activeEventsCount: 2,
  totalEventsToday: 147,
  isLive: true,
};

export const DEFAULT_FRIGATE_CONFIG_YAML = `# Frigate NVR Production Configuration
# Official Documentation: https://docs.frigate.video/
mqtt:
  enabled: true
  host: 192.168.1.15
  port: 1883
  topic_prefix: frigate
  client_id: frigate_nvr_main

detectors:
  coral:
    type: edgetpu
    device: usb

model:
  width: 320
  height: 320
  input_tensor: nhwc
  input_pixel_format: rgb

database:
  path: /media/frigate/frigate.db

record:
  enabled: true
  retain:
    days: 7
    mode: all
  alerts:
    retain:
      days: 30
      mode: active_objects
  detections:
    retain:
      days: 14
      mode: motion

snapshots:
  enabled: true
  clean_copy: true
  timestamp: true
  bounding_box: true
  crop: false
  retain:
    default: 14
    objects:
      person: 30
      package: 60

objects:
  track:
    - person
    - car
    - dog
    - cat
    - package
    - bicycle
  filters:
    person:
      min_area: 4000
      max_area: 250000
      min_score: 0.65
      threshold: 0.75
    package:
      min_score: 0.60
      threshold: 0.70

cameras:
  driveway:
    ffmpeg:
      inputs:
        - path: rtsp://admin:secret123@192.168.1.51:554/h264Preview_01_main
          roles:
            - record
        - path: rtsp://admin:secret123@192.168.1.51:554/h264Preview_01_sub
          roles:
            - detect
      hwaccel_args: preset-vaapi
    detect:
      width: 1280
      height: 720
      fps: 10
    zones:
      driveway_parking:
        coordinates: 0.15,0.45,0.82,0.48,0.92,0.95,0.08,0.92
        objects:
          - car
          - person
      public_sidewalk:
        coordinates: 0.05,0.25,0.95,0.28,0.95,0.42,0.05,0.40
        objects:
          - person
          - dog
    motion:
      mask:
        - 0.0,0.0,0.35,0.0,0.3,0.28,0.0,0.32

  front_porch:
    ffmpeg:
      inputs:
        - path: rtsp://admin:secret123@192.168.1.52:554/live/ch0
          roles:
            - record
            - detect
      hwaccel_args: preset-vaapi
    detect:
      width: 1280
      height: 720
      fps: 10
    zones:
      doorstep_package_zone:
        coordinates: 0.28,0.52,0.72,0.52,0.82,0.96,0.18,0.96
        objects:
          - package
          - person

  backyard:
    ffmpeg:
      inputs:
        - path: rtsp://admin:secret123@192.168.1.53:554/live/ch0
          roles:
            - record
            - detect
      hwaccel_args: preset-vaapi
    detect:
      width: 1280
      height: 720
      fps: 10
    zones:
      patio_deck:
        coordinates: 0.12,0.60,0.88,0.62,0.96,0.98,0.04,0.98
        objects:
          - person
          - dog

  street_front:
    ffmpeg:
      inputs:
        - path: rtsp://admin:secret123@192.168.1.54:554/live/ch0
          roles:
            - record
            - detect
      hwaccel_args: preset-vaapi
    detect:
      width: 1280
      height: 720
      fps: 10
    zones:
      curb_parking:
        coordinates: 0.02,0.55,0.98,0.52,0.98,0.88,0.02,0.92
        objects:
          - car

  garage_interior:
    ffmpeg:
      inputs:
        - path: rtsp://admin:secret123@192.168.1.55:554/live/ch0
          roles:
            - record
            - detect
      hwaccel_args: preset-vaapi
    detect:
      width: 1280
      height: 720
      fps: 10
    zones:
      vehicle_bay:
        coordinates: 0.2,0.4,0.85,0.4,0.92,0.92,0.15,0.92
        objects:
          - car
          - person

  side_gate:
    ffmpeg:
      inputs:
        - path: rtsp://admin:secret123@192.168.1.56:554/live/ch0
          roles:
            - record
            - detect
      hwaccel_args: preset-vaapi
    detect:
      width: 1280
      height: 720
      fps: 10
    zones:
      side_pathway:
        coordinates: 0.25,0.35,0.75,0.35,0.85,0.95,0.15,0.95
        objects:
          - person
`;
