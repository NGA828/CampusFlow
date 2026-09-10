'use client';

import { useMemo, useState } from 'react';
import { useAsync, dayName } from '../../../../lib/hooks';
import { staffApi } from '../../../../lib/api/endpoints';
import { ApiError } from '../../../../lib/api/client';
import { Badge, Button, Card, CardSkeleton, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Tabs, Textarea } from '../../../../components/ui/kit';
import { PageHeader } from '../../../../components/layout/app-shell';
import { useToast } from '../../../../components/ui/toast';
import type { StaffTimetableRow } from '../../../../lib/api/types';

const SESSION_TYPES = ['lecture', 'lab', 'tutorial', 'seminar', 'exam'] as const;

interface EntryDraft {
  id?: string;
  course_id: string;
  room_id: string;
  day_of_week: string;
  starts_at: string;
  ends_at: string;
  session_type: string;
  group_code: string;
  notes: string;
  term_code: string;
}

const EMPTY_DRAFT: EntryDraft = {
  course_id: '',
  room_id: '',
  day_of_week: '1',
  starts_at: '09:00',
  ends_at: '11:00',
  session_type: 'lecture',
  group_code: '',
  notes: '',
  term_code: '',
};

export default function StaffTimetablePage() {
  const toast = useToast();
  const [day, setDay] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StaffTimetableRow | null>(null);

  const timetable = useAsync(
    () => staffApi.timetable(day === 'all' ? {} : { day_of_week: Number(day) }),
    [day],
  );

  const entries = timetable.data?.entries ?? [];

  const byDay = useMemo(() => {
    const map = new Map<number, StaffTimetableRow[]>();
    for (const entry of entries) {
      const list = map.get(entry.day_of_week) ?? [];
      list.push(entry);
      map.set(entry.day_of_week, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [entries]);

  const openCreate = () => {
    setFormError(null);
    setDraft({ ...EMPTY_DRAFT, term_code: entries[0]?.term_code ?? '' });
  };

  const openEdit = (entry: StaffTimetableRow) => {
    setFormError(null);
    setDraft({
      id: entry.id,
      course_id: entry.course_id,
      room_id: entry.room_id ?? '',
      day_of_week: String(entry.day_of_week),
      starts_at: entry.starts_at.slice(0, 5),
      ends_at: entry.ends_at.slice(0, 5),
      session_type: entry.session_type,
      group_code: entry.group_code ?? '',
      notes: entry.notes ?? '',
      term_code: entry.term_code,
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    const body = {
      course_id: draft.course_id,
      room_id: draft.room_id || null,
      day_of_week: Number(draft.day_of_week),
      starts_at: draft.starts_at,
      ends_at: draft.ends_at,
      session_type: draft.session_type,
      group_code: draft.group_code || undefined,
      notes: draft.notes || undefined,
      term_code: draft.term_code || undefined,
    };
    try {
      if (draft.id) {
        await staffApi.updateEntry(draft.id, body);
        toast.success('Timetable entry updated', 'Students enrolled in the course see the change immediately.');
      } else {
        await staffApi.createEntry(body);
        toast.success('Timetable entry published', 'It now appears on every enrolled student’s timetable.');
      }
      setDraft(null);
      timetable.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save this entry.';
      setFormError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await staffApi.deleteEntry(pendingDelete.id);
      toast.success('Entry removed');
      timetable.reload();
    } catch (caught) {
      toast.error('Delete failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Try again.');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Teaching timetable"
        description="Sessions you teach or co-teach this term. Publishing an entry updates every enrolled student’s personalised timetable."
        actions={
          timetable.data?.can_manage ? (
            <Button size="sm" onClick={openCreate}>
              Add session
            </Button>
          ) : (
            <Badge tone="neutral">Read-only — no timetable permission</Badge>
          )
        }
      />

      <div className="mb-4">
        <Tabs
          value={day}
          onChange={setDay}
          tabs={[
            { value: 'all', label: 'All days' },
            { value: '1', label: 'Mon' },
            { value: '2', label: 'Tue' },
            { value: '3', label: 'Wed' },
            { value: '4', label: 'Thu' },
            { value: '5', label: 'Fri' },
          ]}
        />
      </div>

      {timetable.error ? <ErrorState message={timetable.error} onRetry={timetable.reload} /> : null}
      {timetable.loading ? (
        <CardSkeleton rows={6} />
      ) : entries.length === 0 ? (
        <EmptyState title="No sessions" description="You are not scheduled to teach any sessions that match this filter." />
      ) : (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7].map((dayNumber) => {
            const list = byDay.get(dayNumber) ?? [];
            if (list.length === 0) return null;
            return (
              <Card key={dayNumber}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[14px] font-semibold text-ink-900">{dayName(dayNumber)}</p>
                  <span className="text-[12px] text-ink-500">{list.length} sessions</span>
                </div>
                <ul className="space-y-2">
                  {list.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-ink-100 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-ink-800">
                          {entry.course_code} · {entry.course_title}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-ink-500">
                          {entry.starts_at.slice(0, 5)}–{entry.ends_at.slice(0, 5)} · {entry.session_type}
                          {entry.room_code ? ` · ${entry.room_code}` : ' · room TBA'}
                          {entry.building_code ? ` (${entry.building_code})` : ''} · {entry.term_code}
                        </p>
                        {entry.notes ? <p className="mt-0.5 text-[12px] text-ink-400">{entry.notes}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{entry.enrolled} enrolled</Badge>
                        {entry.group_code ? <Badge tone="brand">{entry.group_code}</Badge> : null}
                        {timetable.data?.can_manage ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => openEdit(entry)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setPendingDelete(entry)}>
                              Remove
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit timetable entry' : 'Publish a timetable entry'}
        description="Only your own courses can be scheduled here. Room conflicts are rejected by the server."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void save()} disabled={!draft?.course_id}>
              {draft?.id ? 'Save changes' : 'Publish session'}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Course" htmlFor="course" error={formError}>
                <Select id="course" value={draft.course_id} onChange={(event) => setDraft({ ...draft, course_id: event.target.value })}>
                  <option value="">Select a course…</option>
                  {(timetable.data?.courses ?? []).map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} · {course.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Room" htmlFor="room">
              <Select id="room" value={draft.room_id} onChange={(event) => setDraft({ ...draft, room_id: event.target.value })}>
                <option value="">Room TBA</option>
                {(timetable.data?.rooms ?? []).map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.code} · {room.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Day" htmlFor="day">
              <Select id="day" value={draft.day_of_week} onChange={(event) => setDraft({ ...draft, day_of_week: event.target.value })}>
                {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                  <option key={value} value={value}>
                    {dayName(value)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Starts" htmlFor="starts">
              <Input id="starts" type="time" value={draft.starts_at} onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })} />
            </Field>
            <Field label="Ends" htmlFor="ends">
              <Input id="ends" type="time" value={draft.ends_at} onChange={(event) => setDraft({ ...draft, ends_at: event.target.value })} />
            </Field>
            <Field label="Session type" htmlFor="session-type">
              <Select id="session-type" value={draft.session_type} onChange={(event) => setDraft({ ...draft, session_type: event.target.value })}>
                {SESSION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Group code" htmlFor="group" hint="Optional, e.g. lab group B.">
              <Input id="group" value={draft.group_code} onChange={(event) => setDraft({ ...draft, group_code: event.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="notes" hint="Visible to enrolled students on their timetable.">
                <Textarea id="notes" rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this session?"
        message={
          pendingDelete
            ? `${pendingDelete.course_code} on ${dayName(pendingDelete.day_of_week)} at ${pendingDelete.starts_at.slice(0, 5)} will no longer appear on any student’s timetable.`
            : ''
        }
        confirmLabel="Remove session"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
