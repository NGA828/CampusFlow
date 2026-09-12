'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAsync, relativeTime } from '@/lib/hooks';
import { adminApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, SectionHeading, Textarea } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { useToast } from '@/components/ui/toast';
import type { AdminAlert } from '@/lib/api/types';

/**
 * `/admin/alerts` — what the platform has noticed about itself.
 *
 * These rows are computed from live state, not stored: an administrator cannot edit an alert away, and
 * an alert cannot sit there describing a condition that ended hours ago. The one thing that *is*
 * persisted is the acknowledgement — a fingerprint mute, written to `alert_acknowledgements` — so a
 * known cause ("yes, we are repainting those codes today") stops shouting without hiding the next,
 * different occurrence of the same class of problem.
 *
 * Admin **mobile** gets the same feed as a read-only list (`GET /admin/alerts` is the whole API it
 * needs); acknowledging and acting on an alert is web-console work, which is exactly the split this
 * project draws between the two platforms.
 */
export default function AdminAlertsPage() {
  const toast = useToast();
  const alerts = useAsync(() => adminApi.alerts(), []);
  const [muted, setMuted] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const acknowledge = async (alert: AdminAlert) => {
    setBusy(alert.key);
    try {
      await adminApi.acknowledgeAlert(alert.key, note[alert.key]?.trim() || undefined);
      setMuted((current) => [...current, alert.key]);
      toast.success('Alert acknowledged', 'This condition stays quiet until it changes again.');
    } catch (caught) {
      toast.error('Could not acknowledge', caught instanceof ApiError ? caught.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (alerts.error) {
    return (
      <div>
        <PageHeader title="Operational alerts" />
        <ErrorState message={alerts.error} onRetry={alerts.reload} />
      </div>
    );
  }

  const rows = (alerts.data?.alerts ?? []).filter((alert) => !muted.includes(alert.key));
  const counts = alerts.data?.counts;

  return (
    <div>
      <PageHeader
        title="Operational alerts"
        description={`Derived from live state · checked ${alerts.data ? relativeTime(alerts.data.generated_at) : '…'}`}
        actions={
          <>
            <Badge tone={counts?.critical ? 'danger' : 'neutral'}>{counts?.critical ?? 0} critical</Badge>
            <Badge tone={counts?.warning ? 'warning' : 'neutral'}>{counts?.warning ?? 0} warnings</Badge>
            <Button variant="secondary" size="sm" onClick={() => alerts.reload()}>
              Re-check
            </Button>
          </>
        }
      />

      {alerts.loading ? (
        <CardSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          description="Every open queue is inside its limit, every controlled room is placed on a map and has a line, and no desk is closed with students still holding a ticket."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((alert) => (
            <Card key={alert.key}>
              <SectionHeading
                title={alert.title}
                description={alert.detail}
                action={
                  <Badge tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'}>
                    {alert.severity}
                  </Badge>
                }
              />
              <p className="mt-1 font-mono text-[11px] text-ink-400">{alert.key}</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Textarea
                  rows={1}
                  value={note[alert.key] ?? ''}
                  onChange={(event) => setNote((current) => ({ ...current, [alert.key]: event.target.value }))}
                  placeholder="Why this is expected (optional)"
                  className="min-w-[16rem] flex-1"
                />
                {alert.target ? (
                  <Link href={alert.target}>
                    <Button size="sm" variant="secondary">
                      Open the screen that fixes it
                    </Button>
                  </Link>
                ) : null}
                <Button size="sm" loading={busy === alert.key} onClick={() => void acknowledge(alert)}>
                  Mute this condition
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
