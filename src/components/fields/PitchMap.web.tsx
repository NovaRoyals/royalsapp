import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { LIGHT_TILES, PIN_BUSY, PIN_CLEAR, PIN_GOLD, PIN_INK, type PitchMapProps } from '@/components/fields/mapTypes';
import { CHANTILLY } from '@/lib/pitchCoords';
import type { LocatedPitch } from '@/lib/pitchCoords';
import type LType from 'leaflet';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function leafletApi(mod: typeof import('leaflet') | { default: typeof import('leaflet') }) {
  return ('map' in mod ? mod : mod.default) as typeof LType;
}

function ensureLeafletCss() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('nr-leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'nr-leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  if (document.getElementById('nr-pin-css')) return;
  const style = document.createElement('style');
  style.id = 'nr-pin-css';
  style.textContent = `
    .nr-marker-wrap { background: none !important; border: none !important; }
    .nr-pin { display: flex; flex-direction: column; align-items: center; transform: translate(-50%, calc(-100% + 10px)); pointer-events: auto; }
    .nr-pin-label {
      background: ${PIN_INK}; color: #fff; font: 700 11px/1.25 system-ui, sans-serif;
      padding: 4px 8px; border-radius: 999px; margin-bottom: 6px; max-width: 150px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 4px 12px rgba(10,36,28,.25);
    }
    .nr-pin-sub { display: block; font-size: 10px; font-weight: 600; opacity: .88; overflow: hidden; text-overflow: ellipsis; }
    .nr-dot { width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 12px var(--glow); }
    .nr-dot.lg { width: 24px; height: 24px; border-color: ${PIN_GOLD}; box-shadow: 0 0 0 1px ${PIN_GOLD}, 0 0 16px var(--glow); }
    .nr-glow { width: 28px; height: 28px; border-radius: 50%; background: var(--glow); opacity: .28; margin-bottom: -24px; }
    .nr-pin.pulse .nr-glow { animation: nr-pin-pulse 1.6s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .nr-pin.pulse .nr-glow { animation: none; } }
    @keyframes nr-pin-pulse { 0%,100% { transform: scale(1); opacity: .28; } 50% { transform: scale(1.55); opacity: .12; } }
    .leaflet-container { font-family: inherit; background: #F3F5F3; height: 100%; width: 100%; }
  `;
  document.head.appendChild(style);
}

function drawPins(
  L: typeof LType,
  layer: LType.LayerGroup,
  map: LType.Map,
  pitches: LocatedPitch[],
  selectedId: string | undefined,
  topPickId: string | undefined,
  reducedMotion: boolean | undefined,
  onSelect: (id: string) => void,
) {
  layer.clearLayers();
  const zoom = map.getZoom();
  for (const pitch of pitches) {
    const selected = pitch.id === selectedId;
    const top = pitch.id === topPickId;
    const showVenue = pitch.isVenueLabel || selected || top;
    const showSub = zoom >= 15 || selected || top;
    const color = pitch.status === 'conflict' ? PIN_BUSY : PIN_CLEAR;
    const large = selected || top;
    const label =
      showVenue || showSub
        ? `<div class="nr-pin-label">${showVenue ? escapeHtml(pitch.name) : ''}${
            showSub ? `<span class="nr-pin-sub">${escapeHtml(pitch.pitch)}</span>` : ''
          }</div>`
        : '';
    const html = `<div class="nr-pin ${top && !reducedMotion ? 'pulse' : ''}">
        ${label}
        <div class="nr-glow" style="--glow:${large ? PIN_GOLD : color}"></div>
        <div class="nr-dot ${large ? 'lg' : ''}" style="background:${color};--glow:${color}"></div>
      </div>`;
    L.marker([pitch.lat, pitch.lng], {
      icon: L.divIcon({ className: 'nr-marker-wrap', html, iconSize: [0, 0], iconAnchor: [0, 0] }),
      zIndexOffset: selected ? 1200 : top ? 800 : 0,
    })
      .on('click', () => onSelect(pitch.id))
      .addTo(layer);
  }
}

export default function PitchMap({
  pitches,
  selectedId,
  topPickId,
  reducedMotion,
  frameKey,
  flyNonce,
  onSelect,
}: PitchMapProps) {
  const stateRef = useRef({ pitches, selectedId, topPickId, reducedMotion, onSelect, frameKey });
  stateRef.current = { pitches, selectedId, topPickId, reducedMotion, onSelect, frameKey };
  const mapRef = useRef<LType.Map | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LType | null>(null);
  const skipFly = useRef(true);

  function redraw() {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    const current = stateRef.current;
    drawPins(L, layer, map, current.pitches, current.selectedId, current.topPickId, current.reducedMotion, current.onSelect);
  }

  useEffect(() => {
    let cancelled = false;
    let map: LType.Map | undefined;
    const timer = setTimeout(async () => {
      ensureLeafletCss();
      const L = leafletApi(await import('leaflet'));
      if (cancelled) return;
      const host = typeof document !== 'undefined' ? document.getElementById('fields-map') : null;
      if (!host) return;
      host.style.height = '100%';
      host.style.width = '100%';
      host.innerHTML = '';
      map = L.map(host, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
      L.tileLayer(LIGHT_TILES, {
        attribution: '&copy; OpenStreetMap &copy; Esri',
        maxZoom: 16,
      }).addTo(map);
      const current = stateRef.current;
      const start = current.pitches.find((item) => item.id === current.topPickId) ?? current.pitches[0];
      map.setView([start?.lat ?? CHANTILLY.lat, start?.lng ?? CHANTILLY.lng], 11);
      leafletRef.current = L;
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      map.on('zoomend', redraw);
      map.invalidateSize();
      redraw();
    }, 40);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      map?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    redraw();
  }, [pitches, reducedMotion, selectedId, topPickId]);

  useEffect(() => {
    const map = mapRef.current;
    const start = pitches.find((item) => item.id === topPickId) ?? pitches[0];
    if (!map || !start) return;
    skipFly.current = true;
    map.setView([start.lat, start.lng], 11);
    map.invalidateSize();
    redraw();
  }, [frameKey, pitches, topPickId]);

  useEffect(() => {
    if (skipFly.current) {
      skipFly.current = false;
      return;
    }
    const map = mapRef.current;
    const pitch = pitches.find((item) => item.id === selectedId);
    if (!map || !pitch) return;
    map.flyTo([pitch.lat, pitch.lng], Math.max(map.getZoom(), 13), { duration: reducedMotion ? 0 : 0.65 });
  }, [flyNonce, pitches, reducedMotion, selectedId]);

  return <View nativeID="fields-map" collapsable={false} style={styles.host} />;
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: '#F3F5F3' },
});
