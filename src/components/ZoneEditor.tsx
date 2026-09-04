import React, { useState, useRef, useEffect } from 'react';
import { CameraStream, ZonePolygon, MotionMask } from '../types';
import { CameraFeedCanvas } from './CameraFeedCanvas';
import {
  Sliders,
  Plus,
  Trash2,
  Copy,
  Check,
  Save,
  RotateCcw,
  Shield,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface ZoneEditorProps {
  cameras: CameraStream[];
  onSaveZones: (cameraId: string, zones: ZonePolygon[], motionMasks: MotionMask[]) => void;
}

export const ZoneEditor: React.FC<ZoneEditorProps> = ({ cameras, onSaveZones }) => {
  const [selectedCameraId, setSelectedCameraId] = useState<string>(cameras[0]?.id || 'driveway');
  const [mode, setMode] = useState<'zone' | 'mask'>('zone');
  const [copied, setCopied] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0];

  const [zones, setZones] = useState<ZonePolygon[]>(selectedCamera?.zones || []);
  const [motionMasks, setMotionMasks] = useState<MotionMask[]>(selectedCamera?.motionMasks || []);
  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);
  const [dragPointIndex, setDragPointIndex] = useState<number | null>(null);

  // Sync state when selected camera changes
  useEffect(() => {
    if (selectedCamera) {
      setZones(selectedCamera.zones || []);
      setMotionMasks(selectedCamera.motionMasks || []);
      setActiveZoneIndex(0);
    }
  }, [selectedCameraId]);

  const activeZone = zones[activeZoneIndex] || null;

  // Handle canvas click to add point
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget.getBoundingClientRect();
    const rawX = (e.clientX - container.left) / container.width;
    const rawY = (e.clientY - container.top) / container.height;
    const normX = Number(Math.max(0, Math.min(1, rawX)).toFixed(2));
    const normY = Number(Math.max(0, Math.min(1, rawY)).toFixed(2));

    if (mode === 'zone' && activeZone) {
      const updated = [...zones];
      updated[activeZoneIndex] = {
        ...activeZone,
        points: [...activeZone.points, [normX, normY]],
      };
      setZones(updated);
    }
  };

  const handleAddNewZone = () => {
    const newId = `zone-${Date.now()}`;
    const newZone: ZonePolygon = {
      id: newId,
      name: `new_zone_${zones.length + 1}`,
      color: ['#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][zones.length % 5],
      points: [
        [0.2, 0.4],
        [0.8, 0.4],
        [0.8, 0.8],
        [0.2, 0.8],
      ],
      objects: ['person', 'car'],
    };
    setZones([...zones, newZone]);
    setActiveZoneIndex(zones.length);
  };

  const handleDeleteActiveZone = () => {
    if (zones.length <= 1) return;
    const updated = zones.filter((_, idx) => idx !== activeZoneIndex);
    setZones(updated);
    setActiveZoneIndex(Math.max(0, activeZoneIndex - 1));
  };

  const handleUpdateZoneName = (name: string) => {
    if (!activeZone) return;
    const updated = [...zones];
    updated[activeZoneIndex] = { ...activeZone, name };
    setZones(updated);
  };

  const handleToggleObject = (objLabel: string) => {
    if (!activeZone) return;
    const current = activeZone.objects || [];
    const updatedObjects = current.includes(objLabel)
      ? current.filter((o) => o !== objLabel)
      : [...current, objLabel];

    const updated = [...zones];
    updated[activeZoneIndex] = { ...activeZone, objects: updatedObjects };
    setZones(updated);
  };

  const handleClearPoints = () => {
    if (!activeZone) return;
    const updated = [...zones];
    updated[activeZoneIndex] = { ...activeZone, points: [] };
    setZones(updated);
  };

  // Generate Frigate YAML snippet for zones
  const generateYaml = (): string => {
    let yaml = `  ${selectedCamera.id}:\n    zones:\n`;
    zones.forEach((z) => {
      const coordStr = z.points.map(([x, y]) => `${x},${y}`).join(',');
      yaml += `      ${z.name}:\n        coordinates: ${coordStr || '0,0,1,0,1,1,0,1'}\n        objects:\n`;
      z.objects.forEach((obj) => {
        yaml += `          - ${obj}\n`;
      });
    });

    if (motionMasks.length > 0) {
      yaml += `    motion:\n      mask:\n`;
      motionMasks.forEach((m) => {
        const maskCoord = m.points.map(([x, y]) => `${x},${y}`).join(',');
        yaml += `        - ${maskCoord}\n`;
      });
    }
    return yaml;
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(generateYaml());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToFrigate = () => {
    onSaveZones(selectedCamera.id, zones, motionMasks);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
            <Sliders className="w-5 h-5 text-slate-200" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
              Spatial Configuration
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
              Zone & Mask Studio
            </h2>
          </div>
        </div>

        {/* Camera Selector Dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-slate-400">Target Feed:</span>
          <select
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            className="bg-slate-950 text-white border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold outline-none focus:border-slate-600 transition-colors"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Canvas (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl">
            {/* Live Camera Feed Canvas */}
            <CameraFeedCanvas
              camera={{
                ...selectedCamera,
                zones,
                motionMasks,
              }}
              showZones={true}
              showMotionMasks={true}
              showBoundingBoxes={false}
              showHud={true}
              className="w-full"
            />

            {/* Transparent Interactive Overlay to capture clicks and vertex handles */}
            <div
              className="absolute inset-0 cursor-crosshair"
              onClick={handleCanvasClick}
            >
              {/* Render vertex grab-points for active zone */}
              {activeZone &&
                activeZone.points.map(([x, y], ptIdx) => (
                  <div
                    key={ptIdx}
                    style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-md bg-white border border-slate-950 flex items-center justify-center text-[8px] font-mono font-black text-slate-950 shadow-lg"
                    title={`Point #${ptIdx + 1} (${x}, ${y})`}
                  >
                    {ptIdx + 1}
                  </div>
                ))}
            </div>

            {/* Instruction tooltip badge */}
            <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-400 shadow flex items-center gap-2 pointer-events-none">
              <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
              <span>Click video canvas to append polygon boundary vertices</span>
            </div>
          </div>

          {/* Quick controls bar below canvas */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Active Partition: <strong className="text-white font-black">{activeZone?.name}</strong> (
              {activeZone?.points.length || 0} vertices)
            </span>
            <button
              onClick={handleClearPoints}
              className="text-slate-400 hover:text-white uppercase tracking-wider text-[10px] font-bold transition-colors"
            >
              Clear Vertices
            </button>
          </div>
        </div>

        {/* Right: Zone Configuration & YAML Preview (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Zone Selector & Management */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.25em] font-mono font-bold text-slate-400">
                Defined Zones ({zones.length})
              </span>
              <button
                id="btn-add-zone"
                onClick={handleAddNewZone}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-[10px] uppercase tracking-wider font-bold transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add Zone</span>
              </button>
            </div>

            {/* Zone list buttons */}
            <div className="space-y-2">
              {zones.map((z, idx) => (
                <div
                  key={z.id}
                  onClick={() => setActiveZoneIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                    idx === activeZoneIndex
                      ? 'bg-slate-950 border-slate-600 text-white shadow-inner font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: z.color || '#ffffff' }}
                    />
                    <span className="font-bold text-white">{z.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">{z.points.length} pts</span>
                </div>
              ))}
            </div>

            {/* Active Zone Editor Form */}
            {activeZone && (
              <div className="pt-4 border-t border-slate-800 space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 font-bold">
                    Zone Identifier
                  </label>
                  <input
                    type="text"
                    value={activeZone.name}
                    onChange={(e) => handleUpdateZoneName(e.target.value)}
                    className="w-full bg-slate-950 text-white px-3.5 py-2 rounded-xl border border-slate-800 outline-none focus:border-slate-600 text-xs font-mono font-medium"
                  />
                </div>

                {/* Filter Objects */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-bold">
                    Monitored Classes
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['person', 'car', 'package', 'dog', 'cat', 'bicycle'].map((obj) => {
                      const isChecked = activeZone.objects.includes(obj);
                      return (
                        <button
                          key={obj}
                          onClick={() => handleToggleObject(obj)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[11px] font-bold transition-colors ${
                            isChecked
                              ? 'bg-white text-slate-950 border-white font-black shadow-sm'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span className="capitalize">{obj}</span>
                          {isChecked && <Check className="w-3.5 h-3.5 text-slate-950" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {zones.length > 1 && (
                  <button
                    onClick={handleDeleteActiveZone}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-red-400 hover:text-red-300 pt-2 font-bold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Zone</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Generated Frigate YAML Box */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.25em] font-mono font-bold text-slate-400">
                Export Frigate YAML
              </span>
              <button
                id="btn-copy-yaml"
                onClick={handleCopyYaml}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-[10px] uppercase tracking-wider font-bold transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-44 leading-relaxed">
              {generateYaml()}
            </pre>

            <button
              id="btn-save-zones"
              onClick={handleSaveToFrigate}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes to NVR</span>
            </button>

            {saveToast && (
              <p className="text-center text-[10px] uppercase tracking-widest font-mono font-bold text-emerald-400 animate-in fade-in">
                ✓ Zones synchronized with Frigate engine
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
