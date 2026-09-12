'use client';

import { type ReactNode } from 'react';
import { Button, Card, CardSkeleton, EmptyState, ErrorState, Input } from '@/components/ui/kit';
import type { PageMeta } from '@/lib/api/types';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right';
}

interface ResourceTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  filters?: ReactNode;
  onCreate?: () => void;
  createLabel?: string;
  meta?: PageMeta;
  onPage?: (page: number) => void;
  rowActions?: (row: T) => ReactNode;
  toolbar?: ReactNode;
}

/**
 * Shared list surface for administration screens: search, filters, pagination and row
 * actions live in one place so every admin table behaves identically.
 */
export function ResourceTable<T>({
  rows,
  columns,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  search,
  filters,
  onCreate,
  createLabel = 'New',
  meta,
  onPage,
  rowActions,
  toolbar,
}: ResourceTableProps<T>) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {search ? (
          <div className="min-w-[220px] flex-1">
            <Input
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              placeholder={search.placeholder ?? 'Search…'}
              aria-label="Search"
            />
          </div>
        ) : null}
        {filters}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          {onCreate ? (
            <Button size="sm" onClick={onCreate}>
              {createLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}

      {loading ? (
        <CardSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={`px-4 py-2.5 text-[11.5px] font-semibold tracking-wide text-ink-500 uppercase ${column.align === 'right' ? 'text-right' : ''} ${column.className ?? ''}`}
                    >
                      {column.header}
                    </th>
                  ))}
                  {rowActions ? <th className="px-4 py-2.5 text-right text-[11.5px] font-semibold tracking-wide text-ink-500 uppercase">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={rowKey(row, index)} className="border-b border-ink-50 last:border-b-0 hover:bg-ink-50/40">
                    {columns.map((column) => (
                      <td key={column.key} className={`px-4 py-3 text-[13px] text-ink-700 ${column.align === 'right' ? 'text-right' : ''} ${column.className ?? ''}`}>
                        {column.render(row)}
                      </td>
                    ))}
                    {rowActions ? <td className="px-4 py-3 text-right">{rowActions(row)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.total_pages > 1 ? (
            <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-[12.5px] text-ink-500">
              <span>
                Page {meta.page} of {meta.total_pages} · {meta.total} rows
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => onPage?.(meta.page - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={meta.page >= meta.total_pages} onClick={() => onPage?.(meta.page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

/** Rows without a uuid still need a stable React key — terms use their human-readable code. */
function rowKey(row: unknown, index: number): string {
  if (row && typeof row === 'object') {
    const record = row as Record<string, unknown>;
    const candidate = record.id ?? record.code ?? record.key;
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate);
  }
  return `row-${index}`;
}

/** Compact horizontal bar chart used by the analytics screens (real values only). */
export function BarChart({ data, labelKey, valueKey, tone = 'brand' }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string; tone?: 'brand' | 'mint' | 'signal' }) {
  const values = data.map((row) => Number(row[valueKey] ?? 0));
  const max = Math.max(1, ...values);
  const tones: Record<string, string> = { brand: 'bg-brand-500', mint: 'bg-mint-500', signal: 'bg-signal-400' };

  return (
    <ul className="space-y-2">
      {data.map((row, index) => {
        const value = Number(row[valueKey] ?? 0);
        return (
          <li key={String(row[labelKey] ?? index)} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-[12px] text-ink-600">{String(row[labelKey] ?? '—')}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
              <span className={`block h-full rounded-full ${tones[tone]}`} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
            </span>
            <span className="tnum w-12 shrink-0 text-right text-[12px] text-ink-500">{value}</span>
          </li>
        );
      })}
    </ul>
  );
}
