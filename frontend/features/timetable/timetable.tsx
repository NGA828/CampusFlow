"use client";

import { useMemo, useState } from "react";
import { studentApi } from "@/lib/api";
import { useApiResource } from "@/hooks/use-api";
import { formatClock, formatDayHeading } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorState, EmptyState, LoadingState } from "@/components/ui/states";
import {
  IconBuilding,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconPin,
  IconUser,
} from "@/components/ui/icons";

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDay(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

export function Timetable() {
  const [selected, setSelected] = useState<Date>(() => new Date());
  const dateKey = useMemo(() => toDateKey(selected), [selected]);

  const { data, error, loading, refetch } = useApiResource(
    () => studentApi.timetable(dateKey),
    [dateKey],
  );

  const isToday = toDateKey(new Date()) === dateKey;
  const isWeekend = selected.getDay() === 0 || selected.getDay() === 6;

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Schedule
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Your classes are sourced from your enrolments — not hardcoded.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected((d) => shiftDay(d, -1))}
            aria-label="Previous day"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 shadow-soft transition-colors hover:bg-ink-50"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSelected(new Date())}
            className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 shadow-soft transition-colors hover:bg-ink-50"
          >
            Today
          </button>
          <button
            onClick={() => setSelected((d) => shiftDay(d, 1))}
            aria-label="Next day"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 shadow-soft transition-colors hover:bg-ink-50"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 text-sm text-ink-700">
        <IconCalendar className="h-4 w-4 text-ink-400" />
        <span className="font-semibold">{formatDayHeading(selected)}</span>
        {isToday ? <Badge tone="brand">Today</Badge> : null}
      </div>

      {loading ? (
        <LoadingState label="Loading schedule…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : isWeekend || !data || data.classes.length === 0 ? (
        <EmptyState
          icon={<IconCalendar className="h-5 w-5" />}
          title="No classes"
          message={
            isWeekend
              ? "It's the weekend — your schedule is clear."
              : "Nothing scheduled for this day."
          }
        />
      ) : (
        <div className="space-y-3">
          {data.classes.map((c) => {
            return (
              <Card
                key={c.id}
                className="flex flex-col gap-4 sm:flex-row sm:items-center"
              >
                <div className="flex w-20 shrink-0 flex-col items-start gap-0.5 border-ink-100 sm:border-r sm:pr-4">
                  <span className="text-sm font-bold text-ink-900 tnum">
                    {formatClock(c.starts_at)}
                  </span>
                  <span className="text-xs text-ink-500 tnum">
                    {formatClock(c.ends_at)}
                  </span>
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-900">
                      {c.course.name}
                    </h3>
                    <Badge
                      tone={
                        c.type === "lab"
                          ? "info"
                          : c.type === "tutorial"
                            ? "accent"
                            : "brand"
                      }
                    >
                      {c.type}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">{c.course.code}</p>
                </div>

                <div className="flex flex-col gap-1 text-xs text-ink-600 sm:w-56 sm:text-right">
                  <span className="inline-flex items-center gap-1.5 sm:justify-end">
                    <IconUser className="h-3.5 w-3.5 text-ink-400" />
                    {c.instructor}
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:justify-end">
                    <IconBuilding className="h-3.5 w-3.5 text-ink-400" />
                    {c.room.code} · {c.room.building.short}
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:justify-end">
                    <IconPin className="h-3.5 w-3.5 text-ink-400" />
                    Floor {c.room.floor}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
