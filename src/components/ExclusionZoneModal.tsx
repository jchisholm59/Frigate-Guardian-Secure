import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Save, HelpCircle, Target, Loader2 } from 'lucide-react';
import { ExclusionZone } from '../types';

type DragInfo =
  | { type: 'vertex'; zoneIndex: number; pointIndex: number }
  | { type: 'shape'; zoneIndex: number; startX: number; startY: number; originalPoints: [number, number][] };

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
  const containerRef = useRef<HTMLDivElement>(null);
  // The reference-frame <img> failing silently rendered as a plain black
  // box (the container's own background) with no indication anything was
  // wrong — easy to mistake for "camera has no light right now" instead of
  // an actual failed fetch. Track load state explicitly so a failure shows
  // as a failure, with a way to retry. cacheBust forces an actual re-fetch
  // on retry — browsers otherwise happily keep re-showing the same failed
  // (or just stale) cached response for an unchanged URL.
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [cacheBust, setCacheBust] = useState(0);
  // Set true by the drag's own mousemove the instant real movement happens,
  // and consumed (reset) by the very next click handler — that's what stops
  // the click-to-add-vertex handler from also firing off the click event a
  // drag's mouseup naturally triggers, which would otherwise drop a stray
  // extra vertex at the end of every drag.
  const didDragRef = useRef(false);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);

  // Reset local editing state whenever the modal opens or the target
  // camera changes — otherwise stale edits from a previous camera bleed in.
  useEffect(() => {
    if (isOpen) {
      const target = initialCameraId || cameras[0]?.id || '';
      setCameraId(target);
      setZones(exclusionZones[target] || []);
      setActiveZoneIndex(0);
      setImageStatus('loading');
      setCacheBust((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialCameraId]);

  const handleSwitchCamera = (id: string) => {
    setCameraId(id);
    setZones(exclusionZones[id] || []);
    setActiveZoneIndex(0);
    setImageStatus('loading');
    setCacheBust((n) => n + 1);
  };

  // Normalizes a mouse position against the reference-frame container,
  // regardless of which element the event actually originated on — needed
  // because drag tracking listens on `window`, not the container itself.
  const getNormalizedPoint = (clientX: number, clientY: number): [number, number] | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Number(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)).toFixed(3));
    const y = Number(Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)).toFixed(3));
    return [x, y];
  };

  // Live-updates the dragged vertex or the whole shape's points while the
  // mouse moves, tracked on `window` (not the element) so the drag keeps
  // working even if the cursor briefly leaves the canvas mid-drag.
  useEffect(() => {
    if (!dragInfo) return;
    const handleMove = (e: MouseEvent) => {
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      if (!pt) return;
      didDragRef.current = true;
      const [nx, ny] = pt;
      setZones((prev) => {
        const zone = prev[dragInfo.zoneIndex];
        if (!zone) return prev;
        const updated = [...prev];
        if (dragInfo.type === 'vertex') {
          const newPoints = [...zone.points];
          newPoints[dragInfo.pointIndex] = [nx, ny];
          updated[dragInfo.zoneIndex] = { ...zone, points: newPoints };
        } else {
          const deltaX = nx - dragInfo.startX;
          const deltaY = ny - dragInfo.startY;
          const newPoints = dragInfo.originalPoints.map(
            ([x, y]) => [Math.max(0, Math.min(1, x + deltaX)), Math.max(0, Math.min(1, y + deltaY))] as [number, number]
          );
          updated[dragInfo.zoneIndex] = { ...zone, points: newPoints };
        }
        return updated;
      });
    };
    const handleUp = () => setDragInfo(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragInfo]);

  if (!isOpen) return null;

  const camera = cameras.find((c) => c.id === cameraId) || cameras[0];
  const activeZone = zones[activeZoneIndex] || null;

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;

    if (!activeZone) {
      // Clicking the canvas with no zone selected (e.g. a fresh camera with
      // none yet) used to silently do nothing — required knowing to hit
      // "+ Add" first, which isn't obvious. Create one on the fly instead,
      // so the canvas is never a dead click target.
      const newZone: ExclusionZone = {
        id: `excl-${Date.now()}`,
        name: `Excluded Area ${zones.length + 1}`,
        points: [pt],
      };
      setZones([...zones, newZone]);
      setActiveZoneIndex(zones.length);
      return;
    }

    const updated = [...zones];
    updated[activeZoneIndex] = { ...activeZone, points: [...activeZone.points, pt] };
    setZones(updated);
  };

  const handleVertexMouseDown = (e: React.MouseEvent, pointIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    didDragRef.current = false;
    setDragInfo({ type: 'vertex', zoneIndex: activeZoneIndex, pointIndex });
  };

  const handleShapeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeZone) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;
    didDragRef.current = false;
    setDragInfo({ type: 'shape', zoneIndex: activeZoneIndex, startX: pt[0], startY: pt[1], originalPoints: activeZone.points });
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
              <div ref={containerRef} className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video">
                {camera?.liveImageUrl ? (
                  <img
                    key={cacheBust}
                    src={`${camera.liveImageUrl}${camera.liveImageUrl.includes('?') ? '&' : '?'}_cb=${cacheBust}`}
                    alt={`${camera.name} reference frame`}
                    className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                    draggable={false}
                    onLoad={() => setImageStatus('loaded')}
                    onError={() => setImageStatus('error')}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs uppercase tracking-wider font-bold">
                    No reference frame available for this camera
                  </div>
                )}

                {/* Proxying through WatchTower to the actual camera server
                    (real network hop, not instant) means this can take a
                    noticeable moment — without this, that gap looked
                    identical to the reference frame just being broken. */}
                {camera?.liveImageUrl && imageStatus === 'loading' && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Loading reference frame…</span>
                  </div>
                )}

                {camera?.liveImageUrl && imageStatus === 'error' && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/90 text-center px-6">
                    <span className="text-rose-400 text-xs uppercase tracking-wider font-bold">
                      Reference frame failed to load
                    </span>
                    <p className="text-slate-500 text-[11px] max-w-xs">
                      Frigate may be unreachable, or this camera's latest snapshot isn't available right now.
                    </p>
                    <button
                      onClick={() => {
                        setImageStatus('loading');
                        setCacheBust((n) => n + 1);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-[10px] uppercase tracking-wider font-bold transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Click-to-add-vertex layer — sits under the zone shapes so
                    the active zone's fill can intercept mousedown for
                    whole-shape dragging before this layer sees the click. */}
                <div className="absolute inset-0 cursor-crosshair" onClick={handleCanvasClick} />

                {/* SVG polygon overlay for every zone on this camera. The
                    <svg> itself ignores pointer events (so clicks on empty
                    space still reach the add-vertex layer below); only the
                    active zone's polygon re-enables them, for shape-dragging. */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ pointerEvents: 'none' }}
                >
                  {zones.map((zone, idx) => {
                    if (zone.points.length < 2) return null;
                    const color = ZONE_COLORS[idx % ZONE_COLORS.length];
                    const pointsAttr = zone.points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ');
                    const isActive = idx === activeZoneIndex;
                    return (
                      <polygon
                        key={zone.id}
                        points={pointsAttr}
                        fill={color}
                        fillOpacity={isActive ? 0.25 : 0.12}
                        stroke={color}
                        strokeWidth={isActive ? 0.6 : 0.3}
                        vectorEffect="non-scaling-stroke"
                        onMouseDown={isActive ? handleShapeMouseDown : undefined}
                        style={isActive ? { pointerEvents: 'auto', cursor: 'move' } : undefined}
                      />
                    );
                  })}
                </svg>

                {/* Vertex handles — topmost layer, each independently
                    draggable to reshape the active zone. */}
                <div className="absolute inset-0 pointer-events-none">
                  {activeZone?.points.map(([x, y], ptIdx) => (
                    <div
                      key={ptIdx}
                      onMouseDown={(e) => handleVertexMouseDown(e, ptIdx)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-md bg-white border border-slate-950 flex items-center justify-center text-[8px] font-mono font-black text-slate-950 shadow-lg cursor-grab active:cursor-grabbing pointer-events-auto"
                      title={`Point #${ptIdx + 1} — drag to move`}
                    >
                      {ptIdx + 1}
                    </div>
                  ))}
                </div>

                <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-400 shadow flex items-center gap-2 pointer-events-none">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
                  <span>Click empty space to add a point — drag a vertex to reshape, or drag inside the zone to move it</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-2">
                <span>
                  Editing: <strong className="text-white font-black">{activeZone?.name || 'No zone selected'}</strong>{' '}
                  {activeZone && <span className="text-slate-500">({activeZone.points.length} vertices)</span>}
                </span>
                <div className="flex items-center gap-3">
                  {camera?.liveImageUrl && (
                    <button
                      onClick={() => {
                        setImageStatus('loading');
                        setCacheBust((n) => n + 1);
                      }}
                      className="text-slate-400 hover:text-white uppercase tracking-wider text-[10px] font-bold transition-colors"
                    >
                      Refresh Frame
                    </button>
                  )}
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
