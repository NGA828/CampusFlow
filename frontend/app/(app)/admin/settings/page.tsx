'use client';

import { useState } from 'react';
import { useAsync, useDebounced, relativeTime } from '@/lib/hooks';
import { adminApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, Card, CardSkeleton, ErrorState, Field, Input, SectionHeading, Tabs } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { ResourceTable, type Column } from '@/components/admin/table';
import { useToast } from '@/components/ui/toast';
import type { AuditLogRow } from '@/lib/api/types';

const KNOWN_SETTINGS: { key: string; label: string; description: string; placeholder?: string }[] = [
  { key: 'campus.timezone', label: 'Campus timezone', description: 'Used for class reminders, service windows and queue deadlines.', placeholder: 'UTC' },
  { key: 'campus.name', label: 'Campus name', description: 'Displayed on the public landing page.' },
  { key: 'queue.default_grace_seconds', label: 'Default queue grace (seconds)', description: 'Extra time after the check-in window before a no-show.', placeholder: '180' },
  { key: 'navigation.off_route_grace_seconds', label: 'Off-route grace (seconds)', description: 'How long a walker may be off-route before the route is recalculated.', placeholder: '20' },
  { key: 'notifications.class_reminder_minutes', label: 'Class reminder lead (minutes)', description: 'How early class reminders are sent.', placeholder: '15' },
];

export default function AdminSettingsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'settings' | 'audit'>('settings');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilter, setAuditFilter] = useState('');
  const debouncedFilter = useDebounced(auditFilter, 300);

  const settings = useAsync(() => adminApi.settings(), []);
  const audit = useAsync(() => adminApi.auditLogs({ page: auditPage, per_page: 25, action: debouncedFilter || undefined }), [auditPage, debouncedFilter]);

  const valueOf = (key: string, fallback: unknown) => {
    if (key in drafts) return drafts[key];
    if (fallback === null || fallback === undefined) return '';
    return typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
  };

  const save = async (key: string, raw: string) => {
    setSavingKey(key);
    try {
      let parsed: unknown = raw;
      const trimmed = raw.trim();
      if (trimmed === 'true') parsed = true;
      else if (trimmed === 'false') parsed = false;
      else if (trimmed !== '' && !Number.isNaN(Number(trimmed))) parsed = Number(trimmed);
      else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          throw new ApiError(422, 'That value looks like JSON but could not be parsed.');
        }
      }
      await adminApi.updateSetting(key, parsed);
      toast.success('Setting saved', key);
      settings.reload();
    } catch (caught) {
      toast.error('Save failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const auditColumns: Column<AuditLogRow>[] = [
    { key: 'action', header: 'Action', render: (row) => <span className="font-mono text-[12px] font-medium text-ink-800">{row.action}</span> },
    { key: 'actor', header: 'Actor', render: (row) => row.actor_name ?? 'system' },
    { key: 'entity', header: 'Entity', render: (row) => <span className="text-[12.5px] text-ink-500">{row.entity_type ?? '—'}</span> },
    { key: 'when', header: 'When', render: (row) => <span title={row.created_at}>{relativeTime(row.created_at)}</span> },
  ];

  if (settings.error) {
    return (
      <div>
        <PageHeader title="Settings" />
        <ErrorState message={settings.error} onRetry={settings.reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings & audit"
        description="Runtime configuration and a complete record of privileged actions. Settings are stored in the database and read by the API at request time."
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'settings', label: 'Configuration', count: settings.data?.settings.length },
            { value: 'audit', label: 'Audit log', count: audit.data?.meta.total },
          ]}
        />
      </div>

      {tab === 'settings' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionHeading title="Operational settings" description="Changes apply to subsequent requests — no restart required." />
            <div className="space-y-4">
              {KNOWN_SETTINGS.map((setting) => {
                const stored = settings.data?.settings.find((item) => item.key === setting.key);
                const value = valueOf(setting.key, stored?.value);
                return (
                  <div key={setting.key} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 basis-[220px] flex-1">
                      <Field label={setting.label} htmlFor={`setting-${setting.key}`} hint={setting.description}>
                        <Input
                          id={`setting-${setting.key}`}
                          placeholder={setting.placeholder}
                          value={value}
                          onChange={(event) => setDrafts({ ...drafts, [setting.key]: event.target.value })}
                        />
                      </Field>
                    </div>
                    <Button className="mb-1.5" size="sm" loading={savingKey === setting.key} onClick={() => void save(setting.key, value)}>
                      Save
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionHeading title="All stored values" description="Anything set on the API, including values written by the scheduler." />
            {settings.loading ? (
              <CardSkeleton rows={5} />
            ) : (settings.data?.settings.length ?? 0) === 0 ? (
              <p className="text-[13px] text-ink-500">No settings have been stored yet.</p>
            ) : (
              <ul className="divide-y divide-ink-50">
                {settings.data?.settings.map((setting) => (
                  <li key={setting.key} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-[12.5px] font-medium text-ink-800">{setting.key}</p>
                      <p className="truncate text-[12px] text-ink-500" title={JSON.stringify(setting.value)}>
                        {JSON.stringify(setting.value)}
                      </p>
                    </div>
                    <Badge tone="neutral">{relativeTime(setting.updated_at)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <ResourceTable
            rows={audit.data?.items ?? []}
            columns={auditColumns}
            loading={audit.loading}
            error={audit.error}
            onRetry={audit.reload}
            search={{ value: auditFilter, onChange: (value) => { setAuditFilter(value); setAuditPage(1); }, placeholder: 'Filter by action prefix, e.g. queue.' }}
            emptyTitle="No audit entries"
            emptyDescription="Actions such as sign-ins, queue operations and configuration changes are recorded here."
            meta={audit.data?.meta}
            onPage={setAuditPage}
          />
        </div>
      )}
    </div>
  );
}
