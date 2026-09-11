import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomIn } from 'lucide-react';
import { AircraftPosition } from '../types';

interface FlightMapProps {
  aircraft: AircraftPosition[];
  homeLat: number;
  homeLon: number;
  selectedHex: string | null;
  onSelectAircraft: (hex: string) => void;
}

const NM_TO_M = 1852;
const MAX_RANGE_NM = 300;
const RING_STEP_NM = 50;

type LayerKey = 'osm' | 'satellite' | 'topo';

const TILE_LAYERS: Record<LayerKey, { label: string; url: string; attribution: string; maxZoom: number }> = {
  osm: {
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
  topo: {
    label: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
    maxZoom: 17,
  },
};

export const FlightMap: React.FC<FlightMapProps> = ({ aircraft, homeLat, homeLon, selectedHex, onSelectAircraft }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const overviewBoundsRef = useRef<L.LatLngBounds | null>(null);
  const overviewZoomRef = useRef<number>(6);
  const onSelectRef = useRef(onSelectAircraft);
  onSelectRef.current = onSelectAircraft;

  const [activeLayer, setActiveLayer] = useState<LayerKey>('osm');
  const [isZoomedIn, setIsZoomedIn] = useState(false);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const home = L.latLng(homeLat, homeLon);
    const overviewBounds = home.toBounds(MAX_RANGE_NM * 2 * NM_TO_M);
    const panBounds = home.toBounds(MAX_RANGE_NM * 2.3 * NM_TO_M);
    overviewBoundsRef.current = overviewBounds;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      maxBounds: panBounds,
      maxBoundsViscosity: 1.0,
    });
    map.fitBounds(overviewBounds);
    overviewZoomRef.current = map.getZoom();
    mapRef.current = map;

    const cfg = TILE_LAYERS.osm;
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom }).addTo(map);

    // Home marker
    L.circleMarker(home, {
      radius: 6,
      color: '#fbbf24',
      fillColor: '#fbbf24',
      fillOpacity: 1,
      weight: 2,
    })
      .addTo(map)
      .bindTooltip('Home', { direction: 'top' });

    // 50nm range rings out to the max range, each with a small north-edge label
    for (let nm = RING_STEP_NM; nm <= MAX_RANGE_NM; nm += RING_STEP_NM) {
      L.circle(home, {
        radius: nm * NM_TO_M,
        color: '#38bdf8',
        weight: 1,
        opacity: 0.35,
        fill: false,
        dashArray: '4 6',
        interactive: false,
      }).addTo(map);

      L.marker([homeLat + nm / 60, homeLon], {
        icon: L.divIcon({
          className: 'range-ring-label',
          html: `<div style="font-size:9px;font-weight:700;color:#7dd3fc;opacity:0.7;white-space:nowrap;">${nm}nm</div>`,
          iconSize: [40, 14],
          iconAnchor: [20, 7],
        }),
        interactive: false,
      }).addTo(map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeLat, homeLon]);

  // Layer switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const cfg = TILE_LAYERS[activeLayer];
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom }).addTo(map);
  }, [activeLayer]);

  // "2x Zoom Home" toggle — a literal 2x scale is +1 zoom level in Leaflet's
  // power-of-two tile scheme. Always relative to the fixed overview zoom
  // (not whatever zoom the user last panned to), so it's a predictable toggle.
  const toggleZoom = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isZoomedIn) {
      if (overviewBoundsRef.current) map.fitBounds(overviewBoundsRef.current);
    } else {
      map.setView([homeLat, homeLon], overviewZoomRef.current + 1, { animate: true });
    }
    setIsZoomedIn((prev) => !prev);
  }, [isZoomedIn, homeLat, homeLon]);

  // Diff aircraft markers in place rather than re-rendering the whole layer,
  // so ~4s polling stays smooth.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    for (const a of aircraft) {
      seen.add(a.hex);
      const isSelected = a.hex === selectedHex;
      const label = a.flight || a.hex.toUpperCase();
      const color = isSelected ? '#fbbf24' : a.onGround ? '#64748b' : '#38bdf8';

      const icon = L.divIcon({
        className: 'flight-marker-icon',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
            <div style="font-size:9px;font-weight:900;color:${isSelected ? '#0a0a0a' : '#e2e8f0'};background:${isSelected ? '#fbbf24' : 'rgba(2,6,23,0.85)'};padding:1px 5px;border-radius:6px;margin-bottom:2px;white-space:nowrap;border:1px solid ${isSelected ? '#fbbf24' : '#334155'};">${label}</div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${color}" style="transform:rotate(${a.track ?? 0}deg);"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
          </div>
        `,
        iconSize: [70, 40],
        iconAnchor: [35, 20],
      });

      const existing = markersRef.current.get(a.hex);
      if (existing) {
        existing.setLatLng([a.lat, a.lon]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([a.lat, a.lon], { icon });
        marker.on('click', () => onSelectRef.current(a.hex));
        marker.addTo(map);
        markersRef.current.set(a.hex, marker);
      }
    }

    for (const [hex, marker] of markersRef.current.entries()) {
      if (!seen.has(hex)) {
        map.removeLayer(marker);
        markersRef.current.delete(hex);
      }
    }
  }, [aircraft, selectedHex]);

  return (
    <div className="relative w-full h-[420px] sm:h-[520px] rounded-2xl overflow-hidden border border-slate-800 shadow-lg">
      <div ref={containerRef} className="w-full h-full bg-slate-900" />

      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5">
        {(Object.keys(TILE_LAYERS) as LayerKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveLayer(key)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
              activeLayer === key ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            {TILE_LAYERS[key].label}
          </button>
        ))}
      </div>

      <div className="absolute top-3 left-3 z-[1000]">
        <button
          onClick={toggleZoom}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-colors ${
            isZoomedIn
              ? 'bg-amber-600 text-white border-amber-500'
              : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:text-white'
          }`}
        >
          <ZoomIn className="w-3 h-3" />
          <span>{isZoomedIn ? 'Overview' : '2x Zoom Home'}</span>
        </button>
      </div>
    </div>
  );
};
