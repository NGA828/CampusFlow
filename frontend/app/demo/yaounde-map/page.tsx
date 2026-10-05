import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  YaoundeDemoMap,
  type DemoBuilding,
  type DemoFacility,
  type DemoUniversity,
} from '@/components/maps/yaounde-demo-map';

/**
 * Dataset preview — not part of the authenticated application.
 *
 * It reads `backend/database/data/*.json` from disk and renders it, so the Yaoundé map can be
 * reviewed without a PHP runtime, a database or a login. The authenticated app reads exactly the
 * same values through GET /campus/universities; this page exists to inspect the dataset itself.
 */
export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), '..', 'backend', 'database', 'data');

async function readDataset<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8')) as T;
}

export default async function YaoundeMapDemoPage() {
  const universities = await readDataset<{
    source: { attribution: string; harvested_at: string };
    city: { name: string; center: { lat: number; lng: number } };
    universities: DemoUniversity[];
  }>('yaounde-universities.json');

  const buildings = await readDataset<{ buildings: DemoBuilding[] }>('yaounde-uy1-buildings.json');
  const facilities = await readDataset<{ facilities: DemoFacility[] }>('yaounde-uy1-facilities.json');

  const counts = universities.universities.reduce<Record<string, number>>((acc, u) => {
    acc[u.type] = (acc[u.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8">
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
          Dataset preview · no API, no login
        </p>
        <h1 className="mt-1 text-[26px] font-bold text-slate-900">
          Yaoundé university map
        </h1>
        <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-slate-600">
          {universities.universities.length} institutions, {buildings.buildings.length} Université
          de Yaoundé I buildings and {facilities.facilities.length} campus facilities, read straight
          from the committed OpenStreetMap datasets. Every
          coordinate, name, phone number and website below came from an Overpass query on{' '}
          {universities.source.harvested_at} — nothing on this map is invented. Fields OpenStreetMap
          does not record are shown as <em>Not recorded</em> rather than filled with a guess.
        </p>
        <p className="mt-2 text-[12px] text-slate-500">
          {counts.public ?? 0} public · {counts.private ?? 0} private ·{' '}
          {counts.confessional ?? 0} confessional
        </p>
      </header>

      <YaoundeDemoMap
        universities={universities.universities}
        buildings={buildings.buildings}
        facilities={facilities.facilities}
        center={universities.city.center}
        attribution={universities.source.attribution}
      />

      <footer className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900">
        <strong>Scope of this preview.</strong> Outdoor street-level routing and the indoor
        navigation graph are not built yet — this page shows the institution and building data the
        routing work will run on. Room interiors seeded inside these real buildings are still
        placeholder data inherited from the old demo campus and are not shown here.
      </footer>
    </main>
  );
}
