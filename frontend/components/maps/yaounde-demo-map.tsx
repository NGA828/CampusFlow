'use client';

/**
 * Dataset preview for the Yaoundé institution map.
 *
 * This renders the committed OpenStreetMap datasets directly, with no API call and no
 * authentication, so the data can be inspected on a machine that has no PHP runtime to serve
 * Laravel. It is a preview harness for `backend/database/data/*.json` — the real application
 * reads the same values through GET /campus/universities.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';

export interface DemoUniversity {
  code: string;
  name: string;
  name_en: string | null;
  short_name: string | null;
  type: 'public' | 'private' | 'confessional';
  operator: string | null;
  lat: number | null;
  lng: number | null;
  boundary: [number, number][] | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  established: string | null;
  wheelchair: 'yes' | 'no' | 'limited' | null;
  is_primary: boolean;
  osm: { type: string; id: number };
}

export interface DemoBuilding {
  code: string;
  name: string;
  lat: number;
  lng: number;
  osm_id: number;
  levels: number | null;
  height_m: number | null;
  category: string;
  status?: string;
  status_reason?: string;
}

interface Props {
  universities: DemoUniversity[];
  buildings: DemoBuilding[];
  center: { lat: number; lng: number };
  attribution: string;
}

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const TYPE_COLOR: Record<DemoUniversity['type'], string> = {
  public: '#1d4ed8',
  private: '#b45309',
  confessional: '#7e22ce',
};

const CATEGORY_COLOR: Record<string, string> = {
  lecture: '#0f766e',
  faculty: '#0369a1',
  research: '#4338ca',
  administration: '#b91c1c',
  residence: '#a16207',
  health: '#be185d',
  utility: '#475569',
};

function accessibility(value: DemoUniversity['wheelchair']): string {
  if (value === 'yes') return 'Step-free access recorded';
  if (value === 'no') return 'No step-free access recorded';
  if (value === 'limited') return 'Limited step-free access';
  return 'Not surveyed';
}

export function YaoundeDemoMap({ universities, buildings, center, attribution }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuildings, setShowBuildings] = useState(true);
  const [selected, setSelected] = useState<DemoUniversity | null>(
    universities.find((u) => u.is_primary) ?? null,
  );

  const locatable = useMemo(
    () => universities.filter((u) => u.lat !== null && u.lng !== null),
    [universities],
  );

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled || !host.current) return;

        map = new maplibre.Map({
          container: host.current,
          style: STYLE,
          center: [center.lng, center.lat],
          zoom: 11.3,
          pitch: 45,
          attributionControl: false,
        });

        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'top-right');
        map.addControl(new maplibre.AttributionControl({ compact: true, customAttribution: attribution }));

        map.on('error', () => {
          if (!cancelled) setError('The map renderer reported an error. Check WebGL support.');
        });

        map.on('load', () => {
          if (cancelled || !map) return;

          // The UY1 campus grounds, the one institution OSM gives a polygon for.
          const uy1 = universities.find((u) => u.boundary && u.boundary.length > 3);
          if (uy1?.boundary) {
            map.addSource('campus-grounds', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: { name: uy1.name },
                geometry: { type: 'Polygon', coordinates: [uy1.boundary] },
              },
            });
            map.addLayer({
              id: 'campus-grounds-fill',
              type: 'fill',
              source: 'campus-grounds',
              paint: { 'fill-color': '#1d4ed8', 'fill-opacity': 0.12 },
            });
            map.addLayer({
              id: 'campus-grounds-line',
              type: 'line',
              source: 'campus-grounds',
              paint: { 'line-color': '#1d4ed8', 'line-width': 2 },
            });
          }

          setReady(true);
        });
      } catch {
        if (!cancelled) setError('The map could not be started. Check WebGL support.');
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
  }, [attribution, center.lat, center.lng, universities]);

  // Markers are rebuilt whenever the building layer is toggled.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    let cancelled = false;

    (async () => {
      const maplibre = await import('maplibre-gl');
      if (cancelled) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      for (const university of locatable) {
        const el = document.createElement('button');
        el.type = 'button';
        el.title = university.name;
        el.setAttribute('aria-label', university.name);
        const size = university.is_primary ? 20 : 14;
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${TYPE_COLOR[university.type]};padding:0`;
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelected(university);
          map.easeTo({ center: [university.lng!, university.lat!], zoom: 15.5, duration: 700 });
        });

        markersRef.current.push(
          new maplibre.Marker({ element: el })
            .setLngLat([university.lng!, university.lat!])
            .addTo(map),
        );
      }

      if (showBuildings) {
        for (const building of buildings) {
          const el = document.createElement('div');
          el.title = `${building.name} — ${building.category}`;
          const colour = CATEGORY_COLOR[building.category] ?? '#475569';
          const closed = building.status === 'closed';
          el.style.cssText = `width:9px;height:9px;border-radius:2px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);background:${colour};opacity:${closed ? 0.45 : 1}`;

          const popup = new maplibre.Popup({ offset: 12, closeButton: false }).setHTML(
            `<strong style="font-size:12px">${building.name}</strong><br/>` +
              `<span style="font-size:11px;color:#555">${building.category}` +
              (building.levels ? ` · ${building.levels} levels` : '') +
              (building.height_m ? ` · ${building.height_m} m` : '') +
              `</span>` +
              (building.status_reason
                ? `<br/><span style="font-size:11px;color:#b91c1c">${building.status_reason}</span>`
                : ''),
          );

          markersRef.current.push(
            new maplibre.Marker({ element: el })
              .setLngLat([building.lng, building.lat])
              .setPopup(popup)
              .addTo(map),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, locatable, buildings, showBuildings]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="relative overflow-hidden rounded-xl border border-slate-300">
        <div ref={host} style={{ height: 560 }} />
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-slate-100/95 p-6 text-center text-sm text-slate-700">
            {error}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[10px] text-slate-600">
          {attribution}
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="rounded-xl border border-slate-300 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Legend</p>
          <ul className="mt-2 space-y-1 text-[12px] text-slate-700">
            {(['public', 'private', 'confessional'] as const).map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-white shadow"
                  style={{ background: TYPE_COLOR[t] }}
                />
                {t[0].toUpperCase() + t.slice(1)} institution
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-[12px] text-slate-700">
            <input
              type="checkbox"
              checked={showBuildings}
              onChange={(event) => setShowBuildings(event.target.checked)}
            />
            Show the {buildings.length} mapped UY1 buildings
          </label>
        </div>

        {selected && (
          <div className="rounded-xl border border-slate-300 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {selected.is_primary ? 'Operated campus' : 'Institution'}
            </p>
            <h2 className="mt-1 text-[15px] font-bold text-slate-900">{selected.name}</h2>
            {selected.name_en && selected.name_en !== selected.name && (
              <p className="text-[12px] text-slate-500">{selected.name_en}</p>
            )}
            <dl className="mt-2 space-y-1 text-[12px] text-slate-700">
              <div>
                <dt className="inline font-semibold">Type: </dt>
                <dd className="inline">{selected.type}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Operator: </dt>
                <dd className="inline">{selected.operator ?? 'Not recorded'}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Phone: </dt>
                <dd className="inline">{selected.phone ?? 'Not recorded'}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Established: </dt>
                <dd className="inline">{selected.established ?? 'Not recorded'}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Access: </dt>
                <dd className="inline">{accessibility(selected.wheelchair)}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Coordinates: </dt>
                <dd className="inline">
                  {selected.lat?.toFixed(5)}, {selected.lng?.toFixed(5)}
                </dd>
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap gap-3">
              {selected.website && (
                <a
                  className="text-[12px] font-semibold text-blue-700 underline"
                  href={selected.website}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Website
                </a>
              )}
              <a
                className="text-[12px] text-slate-500 underline"
                href={`https://www.openstreetmap.org/${selected.osm.type}/${selected.osm.id}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Verify in OpenStreetMap
              </a>
            </div>
          </div>
        )}

        <div className="max-h-[260px] overflow-auto rounded-xl border border-slate-300 bg-white p-2">
          <ul className="space-y-1">
            {locatable.map((u) => (
              <li key={u.code}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(u);
                    mapRef.current?.easeTo({ center: [u.lng!, u.lat!], zoom: 15.5, duration: 700 });
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                    selected?.code === u.code ? 'bg-blue-50 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: TYPE_COLOR[u.type] }}
                  />
                  <span className="truncate">{u.short_name || u.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
