import React, { useEffect, useRef, useState } from 'react';
import { CameraStream, DetectedObject, ZonePolygon, MotionMask } from '../types';

interface CameraFeedCanvasProps {
  camera: CameraStream;
  isPaused?: boolean;
  showBoundingBoxes?: boolean;
  showZones?: boolean;
  showMotionMasks?: boolean;
  showHud?: boolean;
  zoom?: number; // 1.0 to 3.0
  panX?: number; // -100 to 100
  panY?: number; // -100 to 100
  className?: string;
  onObjectClick?: (object: DetectedObject) => void;
  onSnapshotTaken?: (dataUrl: string) => void;
}

export const CameraFeedCanvas: React.FC<CameraFeedCanvasProps> = ({
  camera,
  isPaused = false,
  showBoundingBoxes = true,
  showZones = false,
  showMotionMasks = false,
  showHud = true,
  zoom = 1,
  panX = 0,
  panY = 0,
  className = '',
  onObjectClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [activeDetections, setActiveDetections] = useState<DetectedObject[]>([]);

  // 1. Identify if this is a real Frigate stream
  const isFrigate = Boolean(camera.frigate_url);

  // 2. Point to the MJPEG proxy for native browser streaming
  const streamUrl = isFrigate
    ? `/api/frigate/proxy/stream?serverUrl=${encodeURIComponent(camera.frigate_url!)}&camera=${camera.id}`
    : (camera.liveStreamUrl || camera.mjpegStreamUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const width = 1280;
    const height = 720;
    canvas.width = width;
    canvas.height = height;

    const render = () => {
      if (!isPaused) {
        time += 0.02;
      }

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Apply digital zoom and pan to the canvas overlays
      if (zoom > 1 || panX !== 0 || panY !== 0) {
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-width / 2 + panX, -height / 2 + panY);
      }

      // Draw background ONLY if NOT a live stream (the <img> handles live feed)
      if (!camera.isLiveStream) {
        drawSceneBackground(ctx, width, height, camera.thumbnailTheme, time);
      }

      // 3. Disable Simulation if Frigate URL is present
      // Only get simulated objects if it's NOT a real Frigate connection
      const currentObjects = isFrigate ? [] : getSimulatedObjects(camera.thumbnailTheme, time);
      setActiveDetections(currentObjects);

      if (!isFrigate && !camera.isLiveStream) {
        currentObjects.forEach((obj) => {
          drawSimulatedObjectVisual(ctx, obj, width, height);
        });
      }

      // 4. Draw Zone Polygons
      if (showZones && camera.zones) {
        camera.zones.forEach((zone) => {
          drawZonePolygon(ctx, zone, width, height);
        });
      }

      // 5. Draw Motion Masks
      if (showMotionMasks && camera.motionMasks) {
        camera.motionMasks.forEach((mask) => {
          drawMotionMask(ctx, mask, width, height);
        });
      }

      // 6. Draw Bounding Boxes for simulated objects
      if (showBoundingBoxes) {
        currentObjects.forEach((obj) => {
          drawBoundingBox(ctx, obj, width, height);
        });
      }

      ctx.restore();

      // 7. Draw HUD overlays
      if (showHud) {
        drawHud(ctx, width, height, camera);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [camera, isPaused, showBoundingBoxes, showZones, showMotionMasks, showHud, zoom, panX, panY, isFrigate]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onObjectClick || activeDetections.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    for (const obj of activeDetections) {
      if (
        clickX >= obj.box.x &&
        clickX <= obj.box.x + obj.box.width &&
        clickY >= obj.box.y &&
        clickY <= obj.box.y + obj.box.height
      ) {
        onObjectClick(obj);
        break;
      }
    }
  };

  return (
    <div className={`relative overflow-hidden bg-black flex items-center justify-center ${className}`} style={{ aspectRatio: '16/9' }}>
      {/* 100% Reliable Native MJPEG Streaming */}
      {camera.isLiveStream && !isPaused && (
        <img
          src={streamUrl}
          alt={camera.name}
          className="max-w-full max-h-full w-auto h-auto object-contain"
          style={{
            transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
            transformOrigin: 'center',
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}

      {/* Overlay Canvas for bounding boxes and UI */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="absolute w-full h-full select-none cursor-pointer z-10 object-contain pointer-events-none"
      />
    </div>
  );
};

// Realistic camera backgrounds
function drawSceneBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: string,
  t: number
) {
  switch (theme) {
    case 'driveway': {
      // Sky & trees
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      skyGrad.addColorStop(0, '#1e293b');
      skyGrad.addColorStop(1, '#334155');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.4);

      // Distant foliage with slight wind motion
      ctx.fillStyle = '#143120';
      ctx.beginPath();
      ctx.arc(80 + Math.sin(t) * 2, 80, 70, 0, Math.PI * 2);
      ctx.arc(160 + Math.cos(t) * 2, 70, 80, 0, Math.PI * 2);
      ctx.fill();

      // House wall / garage frame
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(w * 0.65, 0, w * 0.35, h * 0.7);
      // Garage door slats
      ctx.fillStyle = '#27272a';
      ctx.fillRect(w * 0.7, h * 0.15, w * 0.28, h * 0.55);
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.7, h * 0.15 + i * (h * 0.09), w * 0.28, h * 0.08);
      }

      // Asphalt driveway
      const driveGrad = ctx.createLinearGradient(0, h * 0.35, 0, h);
      driveGrad.addColorStop(0, '#18181b');
      driveGrad.addColorStop(1, '#09090b');
      ctx.fillStyle = driveGrad;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.45);
      ctx.lineTo(w * 0.7, h * 0.4);
      ctx.lineTo(w, h * 0.7);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();

      // Sidewalk concrete strip
      ctx.fillStyle = '#52525b';
      ctx.fillRect(0, h * 0.38, w * 0.65, h * 0.08);
      ctx.strokeStyle = '#3f3f46';
      ctx.beginPath();
      for (let x = 30; x < w * 0.65; x += 60) {
        ctx.moveTo(x, h * 0.38);
        ctx.lineTo(x - 10, h * 0.46);
      }
      ctx.stroke();

      // Lawn grass
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.46);
      ctx.lineTo(w * 0.3, h * 0.46);
      ctx.lineTo(0, h * 0.9);
      ctx.fill();
      break;
    }

    case 'front_porch': {
      // Brick walls
      ctx.fillStyle = '#451a03';
      ctx.fillRect(0, 0, w, h);

      // Brick pattern
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1;
      for (let y = 10; y < h * 0.6; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Dark wood door frame & door
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(w * 0.32, h * 0.05, w * 0.36, h * 0.85);

      // Door panels
      ctx.fillStyle = '#292524';
      ctx.fillRect(w * 0.36, h * 0.12, w * 0.12, h * 0.3);
      ctx.fillRect(w * 0.52, h * 0.12, w * 0.12, h * 0.3);
      ctx.fillRect(w * 0.36, h * 0.48, w * 0.12, h * 0.35);
      ctx.fillRect(w * 0.52, h * 0.48, w * 0.12, h * 0.35);

      // Brass door handle
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(w * 0.64, h * 0.52, 4, 0, Math.PI * 2);
      ctx.fill();

      // Welcome Doormat
      ctx.fillStyle = '#78350f';
      ctx.fillRect(w * 0.34, h * 0.78, w * 0.32, h * 0.16);
      ctx.strokeStyle = '#451a03';
      ctx.strokeRect(w * 0.34, h * 0.78, w * 0.32, h * 0.16);

      // Porch stone ground
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
      break;
    }

    case 'backyard': {
      // Horizon sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.3);
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(1, '#1e293b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.35);

      // Wooden fence
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, h * 0.25, w, h * 0.2);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.25);
        ctx.lineTo(x, h * 0.45);
        ctx.stroke();
      }

      // Green lawn
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, h * 0.45, w, h * 0.25);

      // Patio deck
      ctx.fillStyle = '#92400e';
      ctx.fillRect(0, h * 0.65, w, h * 0.35);
      ctx.strokeStyle = '#78350f';
      for (let y = h * 0.65; y < h; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Patio table & chairs
      ctx.fillStyle = '#18181b';
      ctx.fillRect(w * 0.72, h * 0.72, 80, 45);
      ctx.fillRect(w * 0.68, h * 0.76, 20, 30);
      ctx.fillRect(w * 0.87, h * 0.76, 20, 30);
      break;
    }

    case 'street_front': {
      // Sky
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h * 0.3);

      // Distant houses
      ctx.fillStyle = '#334155';
      ctx.fillRect(40, h * 0.15, 120, h * 0.2);
      ctx.fillRect(220, h * 0.12, 160, h * 0.23);
      ctx.fillRect(440, h * 0.16, 140, h * 0.19);

      // Sidewalk
      ctx.fillStyle = '#52525b';
      ctx.fillRect(0, h * 0.35, w, h * 0.15);

      // Road Asphalt
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, h * 0.5, w, h * 0.5);

      // Road dashed white center line
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 4;
      ctx.setLineDash([25, 20]);
      ctx.beginPath();
      ctx.moveTo(0, h * 0.75);
      ctx.lineTo(w, h * 0.75);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }

    case 'garage_interior': {
      // Walls
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, w, h);

      // Overhead fluorescent light strip
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(w * 0.3, 10, w * 0.4, 8);
      ctx.shadowColor = '#fef08a';
      ctx.shadowBlur = 20;
      ctx.fillRect(w * 0.3, 10, w * 0.4, 8);
      ctx.shadowBlur = 0;

      // Pegboard and tool chest
      ctx.fillStyle = '#18181b';
      ctx.fillRect(20, 60, 140, 160);
      ctx.fillStyle = '#dc2626'; // red toolbox
      ctx.fillRect(30, 160, 120, 60);

      // Concrete floor with tire marks
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(w * 0.35, h * 0.6, 60, h * 0.4);
      ctx.fillRect(w * 0.65, h * 0.6, 60, h * 0.4);
      break;
    }

    case 'side_gate': {
      // Night IR illumination aesthetic
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      // Alleyway walls
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, w * 0.25, h);
      ctx.fillRect(w * 0.75, 0, w * 0.25, h);

      // Wooden gate in center
      ctx.fillStyle = '#374151';
      ctx.fillRect(w * 0.25, h * 0.25, w * 0.5, h * 0.5);

      // Gate vertical bars
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 3;
      for (let x = w * 0.25; x < w * 0.75; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.25);
        ctx.lineTo(x, h * 0.75);
        ctx.stroke();
      }

      // Ground gravel
      ctx.fillStyle = '#111827';
      ctx.fillRect(w * 0.25, h * 0.75, w * 0.5, h * 0.25);
      break;
    }
  }

  // Subtle surveillance scanlines effect
  ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1.5);
  }
}

// Generate realistic simulated moving objects based on scene time
function getSimulatedObjects(theme: string, t: number): DetectedObject[] {
  const objects: DetectedObject[] = [];

  switch (theme) {
    case 'driveway': {
      // Parked / moving car
      const carCycle = (t * 0.15) % 10;
      const isCarPresent = carCycle < 8.5;
      if (isCarPresent) {
        // Car rests in driveway
        objects.push({
          id: 'obj-car-1',
          label: 'car',
          score: 0.94,
          stationary: true,
          currentZone: 'driveway_parking',
          box: {
            x: 0.32,
            y: 0.52,
            width: 0.42,
            height: 0.34,
          },
        });
      }

      // Pedestrian walking along sidewalk
      const personX = ((t * 0.08) % 1.6) - 0.3;
      if (personX > -0.1 && personX < 1.0) {
        objects.push({
          id: 'obj-person-1',
          label: 'person',
          score: 0.88,
          stationary: false,
          currentZone: 'public_sidewalk',
          box: {
            x: personX,
            y: 0.26,
            width: 0.08,
            height: 0.22,
          },
        });
      }
      break;
    }

    case 'front_porch': {
      // Stationary parcel on doorstep
      objects.push({
        id: 'obj-package-1',
        label: 'package',
        score: 0.92,
        stationary: true,
        currentZone: 'doorstep_package_zone',
        box: {
          x: 0.42,
          y: 0.76,
          width: 0.14,
          height: 0.14,
        },
      });

      // Periodic visitor/courier approaching
      const courierCycle = (t * 0.2) % 12;
      if (courierCycle > 3 && courierCycle < 8) {
        // Walk forward then pause
        const progress = (courierCycle - 3) / 5;
        const posY = progress < 0.6 ? 0.35 + progress * 0.25 : 0.5;
        objects.push({
          id: 'obj-courier-1',
          label: 'person',
          score: 0.91,
          stationary: progress >= 0.6,
          currentZone: 'doorstep_package_zone',
          box: {
            x: 0.44,
            y: posY,
            width: 0.18,
            height: 0.42,
          },
        });
      }
      break;
    }

    case 'backyard': {
      // Dog running in yard
      const dogX = 0.35 + Math.sin(t * 0.8) * 0.25;
      const dogY = 0.58 + Math.cos(t * 0.6) * 0.12;
      objects.push({
        id: 'obj-dog-1',
        label: 'dog',
        score: 0.86,
        stationary: false,
        currentZone: 'patio_deck',
        box: {
          x: dogX,
          y: dogY,
          width: 0.15,
          height: 0.16,
        },
      });
      break;
    }

    case 'street_front': {
      // Car driving on street
      const carProgress = ((t * 0.4) % 2.0) - 0.5;
      if (carProgress > -0.3 && carProgress < 1.1) {
        objects.push({
          id: 'obj-street-car-1',
          label: 'car',
          score: 0.96,
          stationary: false,
          currentZone: 'curb_parking',
          box: {
            x: carProgress,
            y: 0.60,
            width: 0.36,
            height: 0.24,
          },
        });
      }
      break;
    }

    case 'garage_interior': {
      // Car in garage bay
      objects.push({
        id: 'obj-garage-car-1',
        label: 'car',
        score: 0.97,
        stationary: true,
        currentZone: 'vehicle_bay',
        box: {
          x: 0.28,
          y: 0.48,
          width: 0.52,
          height: 0.38,
        },
      });
      break;
    }

    case 'side_gate': {
      // Occasional cat or person
      const catCycle = (t * 0.3) % 15;
      if (catCycle > 4 && catCycle < 10) {
        const catX = 0.25 + ((catCycle - 4) / 6) * 0.5;
        objects.push({
          id: 'obj-cat-1',
          label: 'cat',
          score: 0.82,
          stationary: false,
          currentZone: 'side_pathway',
          box: {
            x: catX,
            y: 0.82,
            width: 0.10,
            height: 0.10,
          },
        });
      }
      break;
    }
  }

  return objects;
}

// Draw actual cartoon/stylized representation of objects
function drawSimulatedObjectVisual(
  ctx: CanvasRenderingContext2D,
  obj: DetectedObject,
  w: number,
  h: number
) {
  const px = obj.box.x * w;
  const py = obj.box.y * h;
  const pw = obj.box.width * w;
  const ph = obj.box.height * h;

  ctx.save();
  if (obj.label === 'car') {
    // Car body
    ctx.fillStyle = '#0284c7'; // modern blue
    ctx.beginPath();
    ctx.roundRect(px, py + ph * 0.4, pw, ph * 0.5, 8);
    ctx.fill();

    // Cabin / roof
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.roundRect(px + pw * 0.2, py + ph * 0.1, pw * 0.6, ph * 0.4, 6);
    ctx.fill();

    // Windows
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(px + pw * 0.25, py + ph * 0.15, pw * 0.22, ph * 0.25);
    ctx.fillRect(px + pw * 0.52, py + ph * 0.15, pw * 0.22, ph * 0.25);

    // Wheels
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(px + pw * 0.22, py + ph * 0.9, ph * 0.16, 0, Math.PI * 2);
    ctx.arc(px + pw * 0.78, py + ph * 0.9, ph * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(px + pw - 6, py + ph * 0.5, 6, 8);
  } else if (obj.label === 'person') {
    // Head
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.arc(px + pw * 0.5, py + ph * 0.18, ph * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Body/Jacket
    ctx.fillStyle = '#e11d48'; // high-vis or red jacket
    ctx.beginPath();
    ctx.roundRect(px + pw * 0.2, py + ph * 0.32, pw * 0.6, ph * 0.38, 4);
    ctx.fill();

    // Legs/Pants
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px + pw * 0.25, py + ph * 0.7, pw * 0.2, ph * 0.28);
    ctx.fillRect(px + pw * 0.55, py + ph * 0.7, pw * 0.2, ph * 0.28);
  } else if (obj.label === 'package') {
    // Cardboard box
    ctx.fillStyle = '#d97706';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);

    // Shipping tape
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(px + pw * 0.4, py, pw * 0.2, ph);
    // Barcode label
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 4, py + 4, pw * 0.3, ph * 0.25);
  } else if (obj.label === 'dog') {
    // Golden dog body
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.roundRect(px, py + ph * 0.3, pw * 0.75, ph * 0.45, 8);
    ctx.fill();

    // Dog head
    ctx.beginPath();
    ctx.arc(px + pw * 0.8, py + ph * 0.35, ph * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillRect(px + pw * 0.1, py + ph * 0.7, pw * 0.12, ph * 0.3);
    ctx.fillRect(px + pw * 0.6, py + ph * 0.7, pw * 0.12, ph * 0.3);
    // Wagging tail
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px, py + ph * 0.4);
    ctx.quadraticCurveTo(px - 10, py + ph * 0.2, px - 6, py + ph * 0.1);
    ctx.stroke();
  } else if (obj.label === 'cat') {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(px, py + ph * 0.4, pw * 0.7, ph * 0.4, 4);
    ctx.fill();
    ctx.arc(px + pw * 0.8, py + ph * 0.45, ph * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Draw Frigate Bounding Box with Label & Score
function drawBoundingBox(
  ctx: CanvasRenderingContext2D,
  obj: DetectedObject,
  w: number,
  h: number
) {
  const px = obj.box.x * w;
  const py = obj.box.y * h;
  const pw = obj.box.width * w;
  const ph = obj.box.height * h;

  const colorMap: Record<string, string> = {
    person: '#10b981', // Emerald green
    car: '#38bdf8', // Light sky blue
    package: '#f59e0b', // Amber
    dog: '#f43f5e', // Rose pink
    cat: '#ec4899',
    bicycle: '#8b5cf6',
  };
  const strokeColor = colorMap[obj.label] || '#38bdf8';

  ctx.save();
  // Bounding box border
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  // Corner brackets (Frigate signature look)
  const cornerLen = Math.min(10, pw * 0.3, ph * 0.3);
  ctx.lineWidth = 3;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(px, py + cornerLen);
  ctx.lineTo(px, py);
  ctx.lineTo(px + cornerLen, py);
  // Top-right
  ctx.moveTo(px + pw - cornerLen, py);
  ctx.lineTo(px + pw, py);
  ctx.lineTo(px + pw, py + cornerLen);
  // Bottom-left
  ctx.moveTo(px, py + ph - cornerLen);
  ctx.lineTo(px, py + ph);
  ctx.lineTo(px + cornerLen, py + ph);
  // Bottom-right
  ctx.moveTo(px + pw - cornerLen, py + ph);
  ctx.lineTo(px + pw, py + ph);
  ctx.lineTo(px + pw, py + ph - cornerLen);
  ctx.stroke();

  // Label tag above bounding box
  const labelText = `${obj.label.toUpperCase()} ${Math.round(obj.score * 100)}%`;
  ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
  const textWidth = ctx.measureText(labelText).width;
  const tagHeight = 18;

  ctx.fillStyle = strokeColor;
  ctx.fillRect(px, Math.max(0, py - tagHeight), textWidth + 12, tagHeight);

  ctx.fillStyle = '#000000';
  ctx.fillText(labelText, px + 6, Math.max(13, py - 4));
  ctx.restore();
}

// Draw Zone Polygon
function drawZonePolygon(
  ctx: CanvasRenderingContext2D,
  zone: ZonePolygon,
  w: number,
  h: number
) {
  if (!zone.points || zone.points.length < 3) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(zone.points[0][0] * w, zone.points[0][1] * h);
  for (let i = 1; i < zone.points.length; i++) {
    ctx.lineTo(zone.points[i][0] * w, zone.points[i][1] * h);
  }
  ctx.closePath();

  // Translucent fill
  ctx.fillStyle = zone.color ? `${zone.color}22` : 'rgba(56, 189, 248, 0.15)';
  ctx.fill();

  // Dashed zone boundary
  ctx.strokeStyle = zone.color || '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Zone Name Tag at first vertex
  const tagX = zone.points[0][0] * w;
  const tagY = zone.points[0][1] * h;
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  const nameText = `ZONE: ${zone.name}`;
  const textWidth = ctx.measureText(nameText).width;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(tagX, tagY - 16, textWidth + 8, 16);
  ctx.strokeStyle = zone.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(tagX, tagY - 16, textWidth + 8, 16);

  ctx.fillStyle = zone.color || '#38bdf8';
  ctx.fillText(nameText, tagX + 4, tagY - 4);
  ctx.restore();
}

// Draw Motion Mask
function drawMotionMask(
  ctx: CanvasRenderingContext2D,
  mask: MotionMask,
  w: number,
  h: number
) {
  if (!mask.points || mask.points.length < 3) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mask.points[0][0] * w, mask.points[0][1] * h);
  for (let i = 1; i < mask.points.length; i++) {
    ctx.lineTo(mask.points[i][0] * w, mask.points[i][1] * h);
  }
  ctx.closePath();

  // Dark diagonal hatch effect
  ctx.fillStyle = 'rgba(24, 24, 27, 0.75)';
  ctx.fill();

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  const tagX = mask.points[0][0] * w;
  const tagY = mask.points[0][1] * h;
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.fillRect(tagX, tagY - 16, 80, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('MOTION MASK', tagX + 4, tagY - 4);
  ctx.restore();
}

// Draw HUD Overlays (Timestamp, Bitrate, FPS, REC status)
function drawHud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: CameraStream
) {
  ctx.save();
  // Top bar background gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, 32);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, 32);

  // Camera Name
  ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText(camera.name.toUpperCase(), 10, 18);

  // REC badge
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(w - 70, 14, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('REC', w - 62, 18);

  // Resolution / Stream type pill
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(w - 36, 6, 28, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(camera.streamType === 'main' ? 'HD' : 'SUB', w - 32, 18);

  // Bottom HUD: Date/Time + FPS + Bitrate
  const d = new Date();
  const dateStr = d.toISOString().replace('T', ' ').substring(0, 19);
  const telemetryStr = `${dateStr}  •  ${camera.fps} FPS  •  ${(camera.bitrateKbps / 1000).toFixed(1)} Mb/s`;

  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = '#e4e4e7';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText(telemetryStr, 10, h - 10);
  ctx.restore();
}
