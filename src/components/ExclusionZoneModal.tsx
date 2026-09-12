import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Save, HelpCircle, Target } from 'lucide-react';
import { ExclusionZone } from '../types';

interface ExclusionZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: { id: string; name: string; liveImageUrl?: string }[];
  initialCameraId?: string;
  exclusionZones: Record<string, ExclusionZone[]>;
  onSave: (cameraId: string, zones: ExclusionZone[]) => void;
}

const ZONE_COLORS = ['#ef4444', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899'];

export const ExclusionZoneModal: React.FC<ExclusionZoneModalProps> = ({
  isOpen,
  onClose,
  cameras,
  initialCameraId,
  exclusionZones,
  onSave,
}) => {
  const [cameraId, setCameraId] = useState(initialCameraId || cameras[0]?.id || '');
  const [zones, setZones] = useState<ExclusionZone[]>(exclusionZones[cameraId] || []);
  const [activeZoneIndex, setActiveZoneIndex] = useState(0);
  const [saveToast, setSaveToast] = useState(false);

  // Reset local editing state whenever the modal opens or the target
  // camera changes — otherwise stale edits from a previous camera bleed in.
  useEffect(() => {
    if (isOpen) {
      const target = initialCameraId || cameras[0]?.id || '';
      setCameraId(target);
      setZones(exclusionZones[target] || []);
      setActiveZoneIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialCameraId]);

  const handleSwitchCamera = (id: string) => {
    setCameraId(id);
    setZones(exclusionZones[id] || []);
    setActiveZoneIndex(0);
  };

  if (!isOpen) return null;

  const camera = cameras.find((c) => c.id === cameraId) || cameras[0];
  const activeZone = zones[activeZoneIndex] || null;

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeZone) return;
    const container = e.currentTarget.getBoundingClientRect();
    const rawX = (e.clientX - container.left) / container.width;
    const rawY = (e.clientY - container.top) / container.height;
    const normX = Number(Math.max(0, Math.min(1, rawX)).toFixed(3));
    const normY = Number(Math.max(0, Math.min(1, rawY)).toFixed(3));

    const updated = [...zones];
    updated[activeZoneIndex] = { ...activeZone, points: [...activeZone.points, [normX, normY]] };
    setZones(updated);
  };

  const handleAddZone = () => {
    const newZone: ExclusionZone = {
      id: `excl-${Date.now()}`,
      name: `Excluded Area ${zones.length + 1}`,
      points: [],
    };
    setZones([...zones, newZone]);
    setActiveZoneIndex(zones.length);
  };

  const handleDeleteZone = (idx: number) => {
    const updated = zones.filter((_, i) => i !== idx);
    setZones(updated);
    setActiveZoneIndex(Math.max(0, Math.min(idx, updated.length - 1)));
  };

  const handleRenameZone = (name: string) => {
    if (!activeZone) return;
    const updated = [...zones];
    updated[activeZoneIndex] = { ...activeZone, name };
    setZones(updated);
  };

  const handleClearVertices = () => {
    if (!activeZone) return;
    const updated = [...zones];
    updated[activeZoneIndex] = { ...activeZone, points: [] };
    setZones(updated);
  };

  const handleSave = () => {
    onSave(cameraId, zones);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
                Notification Filtering — Not Sent To Frigate
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">Exclusion Zones</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <p className="text-xs text-slate-400 mb-4">
            Draw a region around anything that keeps falsely triggering — a parked car, a flag, a tree branch.
            Detections centered inside it are silently skipped before any alert goes out, regardless of what Frigate
            itself thinks about the object's motion.
          </p>

          {/* Camera selector */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-slate-400">Camera:</span>
              <select
                value={cameraId}
                onChange={(e) => handleSwitchCamera(e.target.value)}
                className="bg-slate-900 text-white border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold outline-none focus:border-slate-600 transition-colors"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {(exclusionZones[c.id]?.length || 0) > 0 ? `(${exclusionZones[c.id].length})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: drawing canvas */}
            <div className="lg:col-span-8">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video">
                {camera?.liveImageUrl ? (
                  <img
                    src={camera.liveImageUrl}
                    alt={`${camera.name} reference frame`}
                    className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs uppercase tracking-wider font-bold">
                    No reference frame available for this camera
                  </div>
                )}

                {/* SVG polygon overlay for every zone on this camera */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {zones.map((zone, idx) => {
                    if (zone.points.length < 2) return null;
                    const color = ZONE_COLORS[idx % ZONE_COLORS.length];
                    const pointsAttr = zone.points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ');
                    return (
                      <polygon
                        key={zone.id}
                        points={pointsAttr}
                        fill={color}
                        fillOpacity={idx === activeZoneIndex ? 0.25 : 0.12}
                        stroke={color}
                        strokeWidth={idx === activeZoneIndex ? 0.6 : 0.3}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>

                {/* Click-to-add-vertex overlay */}
                <div className="absolute inset-0 cursor-crosshair" onClick={handleCanvasClick}>
                  {activeZone?.points.map(([x, y], ptIdx) => (
                    <div
                      key={ptIdx}
                      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-md bg-white border border-slate-950 flex items-center justify-center text-[8px] font-mono font-black text-slate-950 shadow-lg"
                      title={`Point #${ptIdx + 1}`}
                    >
                      {ptIdx + 1}
                    </div>
                  ))}
                </div>

                <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-400 shadow flex items-center gap-2 pointer-events-none">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
                  <span>Click to place vertices — at least 3 needed for the zone to take effect</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-2">
                <span>
                  Editing: <strong className="text-white font-black">{activeZone?.name || 'No zone selected'}</strong>{' '}
                  {activeZone && <span className="text-slate-500">({activeZone.points.length} vertices)</span>}
                </span>
                {activeZone && (
                  <button
                    onClick={handleClearVertices}
                    className="text-slate-400 hover:text-white uppercase tracking-wider text-[10px] font-bold transition-colors"
                  >
                    Clear Vertices
                  </button>
                )}
              </div>
            </div>

            {/* Right: zone list + management */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.25em] font-mono font-bold text-slate-400">
                    Excluded Areas ({zones.length})
                  </span>
                  <button
                    onClick={handleAddZone}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-[10px] uppercase tracking-wider font-bold transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>

                {zones.length === 0 && (
                  <p className="text-[11px] text-slate-500 py-2">No excluded areas on this camera yet.</p>
                )}

                <div className="space-y-2">
                  {zones.map((z, idx) => (
                    <div
                      key={z.id}
                      onClick={() => setActiveZoneIndex(idx)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                        idx === activeZoneIndex
                          ? 'bg-slate-950 border-slate-600 text-white shadow-inner font-bold'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: ZONE_COLORS[idx % ZONE_COLORS.length] }}
                        />
                        <span className="font-bold text-white truncate">{z.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">
                          {z.points.length} pts
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(idx);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {activeZone && (
                  <div className="pt-3 border-t border-slate-800">
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 font-bold">
                      Area Name
                    </label>
                    <input
                      type="text"
                      value={activeZone.name}
                      onChange={(e) => handleRenameZone(e.target.value)}
                      className="w-full bg-slate-950 text-white px-3.5 py-2 rounded-xl border border-slate-800 outline-none focus:border-slate-600 text-xs font-mono font-medium"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Save Exclusion Zones</span>
              </button>

              {saveToast && (
                <p className="text-center text-[10px] uppercase tracking-widest font-mono font-bold text-emerald-400 animate-in fade-in">
                  ✓ Saved
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
