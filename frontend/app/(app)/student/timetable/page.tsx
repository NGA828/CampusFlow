'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync, useMediaQuery, formatClock, dayName, dayShort, formatDate } from '@/lib/hooks';
import { studentApi } from '@/lib/api/endpoints';
import type { TimetableEntry } from '@/lib/api/types';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, SegmentedControl } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';

const HOURS = Array.from({ length: 13 }, (_, index) => 8 + index); // 08:00 → 20:00

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export default function TimetablePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  // The five-column week grid needs room to breathe; below 768px the day list is the default
  // (an explicit choice with the segmented control always wins).
  const wideEnoughForGrid = useMediaQuery('(min-width: 768px)');
  const [chosenView, setChosenView] = useState<'grid' | 'list' | null>(null);
  const view = chosenView ?? (wideEnoughForGrid ? 'grid' : 'list');

  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1) + weekOffset * 7);
    return monday.toISOString().slice(0, 10);
  }, [weekOffset]);

  const timetable = useAsync(() => studentApi.timetable(weekStart), [weekStart]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();
    for (const entry of timetable.data?.entries ?? []) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => minutesOf(a.starts_at) - minutesOf(b.starts_at));
    return map;
  }, [timetable.data]);

  const dates = timetable.data?.dates ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Timetable"
        description="Your week is built from the courses you are enrolled in, using the master timetable published by your faculty."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setWeekOffset((offset) => offset - 1)} aria-label="Previous week">
              ←
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
              This week
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekOffset((offset) => offset + 1)} aria-label="Next week">
              →
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={view}
          onChange={(next) => setChosenView(next)}
          size="sm"
          options={[
            { value: 'grid', label: 'Week grid' },
            { value: 'list', label: 'Day list' },
          ]}
        />
        <p className="text-[13px] text-ink-500">
          {timetable.loading ? 'Loading…' : `${timetable.data?.term ?? ''} · week of ${timetable.data ? formatDate(timetable.data.week_start, { weekday: 'long' }) : ''}`}
        </p>
      </div>

      {timetable.error ? <ErrorState message={timetable.error} onRetry={timetable.reload} /> : null}

      {timetable.loading ? (
        <CardSkeleton rows={6} />
      ) : timetable.data && timetable.data.entries.length === 0 ? (
        <EmptyState
          title="No sessions this week"
          description="Either this week has no scheduled teaching, or you are not enrolled in any courses for this term."
          action={
            <Link href="/student/campus/events">
              <Button variant="secondary" size="sm">
                Browse campus events
              </Button>
            </Link>
          }
        />
      ) : view === 'grid' ? (
        <div className="surface overflow-hidden">
          <div className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))] border-b border-ink-100 bg-ink-50/60 text-[12px] font-medium text-ink-500">
            <div className="px-2 py-2" />
            {dates.slice(0, 5).map((date) => (
              <div key={date} className={`px-3 py-2 ${date === today ? 'bg-brand-50 text-brand-700' : ''}`}>
                <span className="block">{dayShort(new Date(`${date}T00:00:00`).getDay() || 7)}</span>
                <span className="tnum block text-[11.5px] font-normal text-ink-500">{date.slice(8)}/{date.slice(5, 7)}</span>
              </div>
            ))}
          </div>

          <div className="relative grid grid-cols-[56px_repeat(5,minmax(0,1fr))]">
            <div className="border-r border-ink-100">
              {HOURS.map((hour) => (
                <div key={hour} className="h-16 border-b border-ink-50 pr-2 pt-1 text-right text-[11px] text-ink-400">
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {dates.slice(0, 5).map((date) => (
              <div key={date} className={`relative border-r border-ink-50 last:border-r-0 ${date === today ? 'bg-brand-50/30' : ''}`}>
                {HOURS.map((hour) => (
                  <div key={hour} className="h-16 border-b border-ink-50" />
                ))}
                {(entriesByDate.get(date) ?? []).map((entry) => {
                  const start = minutesOf(entry.starts_at);
                  const end = minutesOf(entry.ends_at);
                  const top = ((start - 8 * 60) / 60) * 64;
                  const height = Math.max(30, ((end - start) / 60) * 64 - 4);
                  return (
                    <Link
                      key={entry.id}
                      href={entry.room_code ? `/student/campus/rooms/${entry.room_code}` : '/student/timetable'}
                      className="absolute inset-x-1 overflow-hidden rounded-[10px] border px-2 py-1.5 text-left transition-shadow hover:shadow-[var(--shadow-card)]"
                      style={{
                        top: Math.max(0, top),
                        height,
                        borderColor: `${entry.course_colour ?? '#4340e0'}44`,
                        backgroundColor: `${entry.course_colour ?? '#4340e0'}18`,
                      }}
                    >
                      <span className="tnum block text-[11.5px] font-semibold" style={{ color: entry.course_colour ?? '#3730bb' }}>
                        {entry.course_code}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-700">{entry.room_code ?? 'TBA'}</span>
                      {height > 54 ? (
                        <span className="mt-0.5 block truncate text-[11px] text-ink-500">
                          {formatClock(entry.starts_at_iso)}–{formatClock(entry.ends_at_iso)} · {entry.session_type}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => {
            const entries = entriesByDate.get(date) ?? [];
            if (entries.length === 0) return null;
            return (
              <Card key={date}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-ink-900">
                      {dayName(new Date(`${date}T00:00:00`).getDay() || 7)} <span className="text-ink-400">{date === today ? '· today' : ''}</span>
                    </p>
                    <p className="text-[12.5px] text-ink-500">{formatDate(`${date}T00:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  </div>
                  {date === today ? <Badge tone="brand">Today</Badge> : null}
                </div>
                <ul className="space-y-2">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-ink-100 px-4 py-3">
                      <span className="tnum w-24 shrink-0 text-[13px] font-medium text-ink-700">
                        {formatClock(entry.starts_at_iso)}
                        <span className="block text-[11.5px] font-normal text-ink-400">{formatClock(entry.ends_at_iso)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium text-ink-800">
                          {entry.course_code} · {entry.course_title}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] text-ink-500">
                          {entry.room_code ?? 'Room TBA'}
                          {entry.building_name ? ` · ${entry.building_name}` : ''} · {entry.session_type} · {entry.lecturer ?? 'TBA'}
                        </span>
                      </span>
                      {entry.room_code ? (
                        <Link href={`/student/campus/map?route=${encodeURIComponent(entry.room_code)}`}>
                          <Button variant="secondary" size="sm">
                            Directions
                          </Button>
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
