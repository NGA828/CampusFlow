'use client';

/**
 * The Yaoundé institution directory.
 *
 * Every value shown here is read from the backend, which seeds it from OpenStreetMap. A field the
 * upstream data does not carry is rendered as "Not recorded" rather than filled with a plausible
 * guess — a phone number or an accessibility claim that nobody surveyed is worse than a gap,
 * because someone will act on it.
 */
import { useMemo, useState } from 'react';
import type { University } from '@/lib/api/types';
import { Badge, Button } from '@/components/ui/kit';

interface Props {
  universities: University[];
  attribution?: string;
  selectedCode?: string | null;
  onSelect?: (university: University) => void;
}

const TYPE_LABEL: Record<University['type'], string> = {
  public: 'Public',
  private: 'Private',
  confessional: 'Confessional',
};

/** OSM leaves `wheelchair` unset far more often than not; unknown must not read as "no". */
function accessibilityLabel(value: University['wheelchair']): string {
  if (value === 'yes') return 'Step-free access recorded';
  if (value === 'no') return 'No step-free access recorded';
  if (value === 'limited') return 'Limited step-free access';
  return 'Accessibility not surveyed';
}

export function UniversityDirectory({ universities, attribution, selectedCode, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | University['type']>('all');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return universities.filter((u) => {
      const matchesType = type === 'all' || u.type === type;
      if (!matchesType) return false;
      if (!needle) return true;
      return `${u.name} ${u.short_name ?? ''} ${u.name_en ?? ''} ${u.code}`.toLowerCase().includes(needle);
    });
  }, [universities, query, type]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search institutions…"
          aria-label="Search institutions"
          className="min-w-0 flex-1 rounded-[12px] border border-ink-200 px-3 py-2 text-[13px]"
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
          aria-label="Filter by institution type"
          className="rounded-[12px] border border-ink-200 px-3 py-2 text-[13px]"
        >
          <option value="all">All types</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="confessional">Confessional</option>
        </select>
      </div>

      <p className="text-[12px] text-ink-500">
        {rows.length} of {universities.length} institutions in Yaoundé
      </p>

      <ul className="flex flex-col gap-2">
        {rows.map((university) => {
          const isSelected = selectedCode === university.code;
          const locatable = university.lat !== null && university.lng !== null;

          return (
            <li
              key={university.id}
              className={`rounded-[14px] border p-3 transition-colors ${
                isSelected ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white hover:bg-ink-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-ink-900">{university.name}</p>
                  {university.name_en && university.name_en !== university.name && (
                    <p className="truncate text-[12px] text-ink-500">{university.name_en}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {university.is_primary && <Badge tone="brand">This campus</Badge>}
                  <Badge>{TYPE_LABEL[university.type]}</Badge>
                </div>
              </div>

              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] text-ink-600 sm:grid-cols-2">
                <div>
                  <dt className="inline font-semibold">Buildings mapped: </dt>
                  <dd className="inline">{university.buildings_count ?? 0}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Access: </dt>
                  <dd className="inline">{accessibilityLabel(university.wheelchair)}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Phone: </dt>
                  <dd className="inline">{university.phone ?? 'Not recorded'}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Operator: </dt>
                  <dd className="inline">{university.operator ?? 'Not recorded'}</dd>
                </div>
              </dl>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={isSelected ? 'primary' : 'secondary'}
                  disabled={!locatable}
                  onClick={() => onSelect?.(university)}
                >
                  {locatable ? 'Show on map' : 'No coordinates'}
                </Button>
                {university.website && (
                  <a
                    href={university.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[12px] font-semibold text-brand-700 underline"
                  >
                    Website
                  </a>
                )}
                {university.osm_url && (
                  <a
                    href={university.osm_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[12px] text-ink-500 underline"
                  >
                    Verify in OpenStreetMap
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <p className="rounded-[12px] border border-dashed border-ink-200 p-4 text-center text-[13px] text-ink-500">
          No institution matches that search.
        </p>
      )}

      {attribution && <p className="text-[11px] text-ink-400">{attribution}</p>}
    </section>
  );
}
