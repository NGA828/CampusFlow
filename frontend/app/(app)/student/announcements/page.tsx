'use client';

import { useMemo, useState } from 'react';
import { useAsync, relativeTime } from '@/lib/hooks';
import { engagementApi } from '@/lib/api/endpoints';
import { Badge, Card, CardSkeleton, EmptyState, ErrorState, Input } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';

export default function AnnouncementsPage() {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<'all' | 'urgent' | 'high' | 'normal'>('all');

  const announcements = useAsync(() => engagementApi.announcements({ per_page: 50 }), []);

  const items = useMemo(() => {
    const list = announcements.data?.items ?? [];
    return list
      .filter((item) => (priority === 'all' ? true : item.priority === priority))
      .filter((item) => (search.trim() ? `${item.title} ${item.body}`.toLowerCase().includes(search.trim().toLowerCase()) : true));
  }, [announcements.data, priority, search]);

  const priorities = ['all', 'urgent', 'high', 'normal'] as const;

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Official notices from faculties, departments and campus administration."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search announcements"
              aria-label="Search announcements"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {priorities.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPriority(item)}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium capitalize ${
                  priority === item ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                }`}
              >
                {item === 'all' ? 'All' : item}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {announcements.error ? <ErrorState message={announcements.error} onRetry={announcements.reload} /> : null}
      {announcements.loading ? (
        <CardSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing to read" description="No announcements match your filters right now." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className={item.priority === 'urgent' ? 'border-coral-200' : item.priority === 'high' ? 'border-signal-200' : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-ink-900">{item.title}</h2>
                    {item.is_pinned ? <Badge tone="brand">Pinned</Badge> : null}
                    {item.priority !== 'normal' ? (
                      <Badge tone={item.priority === 'urgent' ? 'danger' : 'warning'}>{item.priority}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-600">{item.body}</p>
                  <p className="mt-3 text-[12px] text-ink-400">
                    {item.author_name ? `${item.author_name} · ` : ''}
                    {item.published_at ? relativeTime(item.published_at) : 'draft'}
                    {item.building_code ? ` · ${item.building_code}` : ''}
                    {item.audience?.length ? ` · for ${item.audience.join(', ')}` : ''}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
