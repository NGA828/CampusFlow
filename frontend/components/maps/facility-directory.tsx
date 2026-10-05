'use client';

/**
 * Campus amenities — the things a student actually searches for mid-day: food, water, a toilet,
 * the pharmacy, a cash point, somewhere to study.
 *
 * Many of these are unnamed in the survey. That is shown honestly via `display_name` ("Drinking
 * water point") rather than inventing a business name, and the category filter stays useful
 * because the *kind* of facility is a surveyed fact even when the name is not.
 */
import { useMemo, useState } from 'react';
import type { Facility, FacilityCategory } from '@/lib/api/types';
import { Badge } from '@/components/ui/kit';

interface Props {
  facilities: Facility[];
  attribution?: string;
  onSelect?: (facility: Facility) => void;
  selectedId?: string | null;
}

const CATEGORY_LABEL: Record<FacilityCategory, string> = {
  food: 'Food & drink',
  study: 'Study',
  health: 'Health',
  money: 'Money',
  water: 'Drinking water',
  sanitation: 'Toilets',
  parking: 'Parking',
  worship: 'Worship',
  culture: 'Culture',
};

const CATEGORY_ICON: Record<FacilityCategory, string> = {
  food: '🍽️',
  study: '📚',
  health: '⚕️',
  money: '💳',
  water: '🚰',
  sanitation: '🚻',
  parking: '🅿️',
  worship: '🛐',
  culture: '🎭',
};

export function FacilityDirectory({ facilities, attribution, onSelect, selectedId }: Props) {
  const [category, setCategory] = useState<FacilityCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  // Only offer categories that actually have rows, so the filter never leads to an empty screen.
  const available = useMemo(() => {
    const counts = new Map<FacilityCategory, number>();
    for (const facility of facilities) {
      counts.set(facility.category, (counts.get(facility.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [facilities]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return facilities.filter((facility) => {
      if (category !== 'all' && facility.category !== category) return false;
      if (!needle) return true;
      return `${facility.display_name} ${facility.osm_amenity ?? ''} ${facility.cuisine ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [facilities, category, query]);

  return (
    <section className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search facilities…"
        aria-label="Search facilities"
        className="rounded-[12px] border border-ink-200 px-3 py-2 text-[13px]"
      />

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            category === 'all' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700'
          }`}
        >
          All {facilities.length}
        </button>
        {available.map(([value, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              category === value ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700'
            }`}
          >
            {CATEGORY_ICON[value]} {CATEGORY_LABEL[value]} {count}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-1.5">
        {rows.map((facility) => (
          <li key={facility.id}>
            <button
              type="button"
              onClick={() => onSelect?.(facility)}
              className={`flex w-full items-start gap-2 rounded-[12px] border p-2.5 text-left transition-colors ${
                selectedId === facility.id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-ink-200 bg-white hover:bg-ink-50'
              }`}
            >
              <span aria-hidden className="text-[15px] leading-none">
                {CATEGORY_ICON[facility.category]}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[13px] ${
                    facility.name ? 'font-semibold text-ink-900' : 'italic text-ink-600'
                  }`}
                >
                  {facility.display_name}
                </span>
                <span className="block text-[11px] text-ink-500">
                  {CATEGORY_LABEL[facility.category]}
                  {facility.cuisine ? ` · ${facility.cuisine}` : ''}
                  {facility.phone ? ` · ${facility.phone}` : ''}
                </span>
              </span>
              {!facility.name && <Badge>Unnamed</Badge>}
            </button>
          </li>
        ))}
      </ul>

      {rows.length === 0 && (
        <p className="rounded-[12px] border border-dashed border-ink-200 p-4 text-center text-[13px] text-ink-500">
          No facility matches that search.
        </p>
      )}

      <p className="text-[11px] text-ink-400">
        Opening hours are not shown: the survey does not record them for these facilities.
        {attribution ? ` ${attribution}` : ''}
      </p>
    </section>
  );
}
