'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import type { University } from '@/lib/types';

/** Keyless raster-free basemap; OpenFreeMap serves the Liberty style without an API key. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const TYPE_LABEL: Record<University['type'], string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
  INTERNATIONAL: 'Inter-state',
  MILITARY: 'Military',
};

export function DirectoryMap({ universities }: { universities: University[] }) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'ALL' | University['type']>('ALL');
  const [selected, setSelected] = useState<string>(universities[0]?.slug ?? '');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return universities.filter((university) => {
      const matchesType = type === 'ALL' || university.type === type;
      const haystack = `${university.name} ${university.shortName} ${university.neighbourhood ?? ''} ${university.city}`.toLowerCase();
      return matchesType && (!needle || haystack.includes(needle));
    });
  }, [universities, query, type]);

  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [11.5174, 3.8667],
      zoom: 11.1,
      attributionControl: { compact: true },
    });
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const marker of markers.current) marker.remove();

    markers.current = visible.map((university) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = university.indoorMappingPriority === 1 ? 'marker markerPriority' : 'marker';
      // textContent, never innerHTML: these strings come from data, not from a template.
      element.textContent = university.indoorMappingPriority === 1 ? '1' : university.shortName.slice(0, 2).toUpperCase();
      element.setAttribute('aria-label', university.name);
      element.addEventListener('click', () => setSelected(university.slug));

      return new maplibregl.Marker({ element })
        .setLngLat(university.coordinates)
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${university.shortName} — ${university.neighbourhood ?? university.city}`))
        .addTo(instance);
    });
  }, [visible]);

  useEffect(() => {
    const university = universities.find((item) => item.slug === selected);
    if (university && map.current) map.current.flyTo({ center: university.coordinates, zoom: 14.2, speed: 0.9 });
  }, [selected, universities]);

  const active = universities.find((item) => item.slug === selected) ?? null;

  return (
    <div className="grid cols2" style={{ gridTemplateColumns: 'minmax(300px, 420px) 1fr', alignItems: 'start' }}>
      <div className="grid" style={{ gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <label className="field" style={{ marginBottom: 10 }}>
            <span>Search the directory</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="IAI, Polytechnique, Melen…"
              aria-label="Search institutions"
            />
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['ALL', 'PUBLIC', 'PRIVATE', 'INTERNATIONAL', 'MILITARY'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`btn btnSmall ${type === value ? '' : 'btnGhost'}`}
                onClick={() => setType(value)}
                aria-pressed={type === value}
              >
                {value === 'ALL' ? `All ${universities.length}` : TYPE_LABEL[value]}
              </button>
            ))}
          </div>
        </div>

        <ul className="list scroller">
          {visible.length === 0 ? <li className="muted">No institution matches that search.</li> : null}
          {visible.map((university) => (
            <li key={university.slug}>
              <button
                type="button"
                className={`row ${selected === university.slug ? 'rowActive' : ''}`}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setSelected(university.slug)}
              >
                <span>
                  <strong style={{ display: 'block' }}>{university.shortName}</strong>
                  <span className="muted">{university.neighbourhood ? `${university.neighbourhood} · ` : ''}{university.city}</span>
                </span>
                <span className={university.indoorMappingPriority === 1 ? 'tag tagGold' : 'tag tagPlain'}>
                  {university.indoorMappingPriority === 1 ? 'Indoor pilot' : TYPE_LABEL[university.type]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        <div ref={container} className="map mapTall" role="application" aria-label="Map of higher-education institutions in Yaoundé" />
        {active ? (
          <article className="card">
            <p className="eyebrow">{TYPE_LABEL[active.type]} · {active.city}</p>
            <h2 style={{ marginTop: 6 }}>{active.name}</h2>
            <p className="muted" style={{ marginTop: 8 }}>{active.description}</p>
            <p className="muted" style={{ marginTop: 10 }}>
              {active.accuracy === 'CAMPUS_POINT'
                ? 'Coordinate taken from a mapped campus feature.'
                : 'Coordinate locates the institution in the city — not a surveyed entrance.'}
            </p>
            <ul className="list" style={{ marginTop: 10 }}>
              {active.sources.map((source) => (
                <li key={source.url} className="muted">
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.claim}
                  </a>
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </div>
    </div>
  );
}
