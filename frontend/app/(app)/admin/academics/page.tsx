'use client';

import { useMemo, useState } from 'react';
import { useAsync, useDebounced, dayName } from '@/lib/hooks';
import { adminApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, Card, ConfirmDialog, Field, Input, Modal, SectionHeading, Select, Tabs, Textarea } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { ResourceTable, type Column } from '@/components/admin/table';
import { useToast } from '@/components/ui/toast';
import type { Course, Enrollment, Term, TimetableEntry } from '@/lib/api/types';

type Tab = 'courses' | 'terms' | 'enrollments' | 'timetable';

export default function AdminAcademicsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('courses');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);
  const [courseDraft, setCourseDraft] = useState<{ id?: string; values: Record<string, string> } | null>(null);
  const [termDraft, setTermDraft] = useState<{ code?: string; values: Record<string, string> } | null>(null);
  const [enrolDraft, setEnrolDraft] = useState<{ values: Record<string, string> } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: Tab; id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [timetableTerm, setTimetableTerm] = useState('');
  const [timetableDay, setTimetableDay] = useState('');

  const courses = useAsync(() => adminApi.courses({ q: debounced || undefined, per_page: 100 }), [debounced]);
  const terms = useAsync(() => adminApi.terms({ per_page: 50 }), []);
  const enrollments = useAsync(() => adminApi.enrollments({ q: debounced || undefined, per_page: 100 }), [debounced]);
  const users = useAsync(() => adminApi.users({ role_code: 'student', per_page: 200 }), []);
  const timetable = useAsync(
    () => adminApi.timetable({ term: timetableTerm || undefined, day_of_week: timetableDay ? Number(timetableDay) : undefined }),
    [timetableTerm, timetableDay],
  );

  const termOptions = useMemo(() => terms.data?.items ?? [], [terms.data]);
  const courseOptions = useMemo(() => courses.data?.items ?? [], [courses.data]);
  const studentOptions = useMemo(() => users.data?.items ?? [], [users.data]);

  const openCourse = (course?: Course) => {
    setFormError(null);
    setCourseDraft({
      id: course?.id,
      values: course
        ? { code: course.code, title: course.title, department: course.department ?? '', credits: String(course.credits), level: course.level ?? 'undergraduate', description: course.description ?? '', colour: course.colour ?? '#3b5bdb' }
        : { code: '', title: '', department: '', credits: '3', level: 'undergraduate', description: '', colour: '#3b5bdb' },
    });
  };

  const saveCourse = async () => {
    if (!courseDraft) return;
    setSaving(true);
    setFormError(null);
    const body = {
      code: courseDraft.values.code,
      title: courseDraft.values.title,
      department: courseDraft.values.department,
      credits: Number(courseDraft.values.credits),
      level: courseDraft.values.level,
      description: courseDraft.values.description || null,
      colour: courseDraft.values.colour,
    };
    try {
      if (courseDraft.id) await adminApi.updateCourse(courseDraft.id, body);
      else await adminApi.createCourse(body);
      toast.success(courseDraft.id ? 'Course updated' : 'Course created');
      courses.reload();
      setCourseDraft(null);
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save the course.';
      setFormError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const saveTerm = async () => {
    if (!termDraft) return;
    setSaving(true);
    setFormError(null);
    const body: Record<string, unknown> = {
      name: termDraft.values.name,
      starts_on: termDraft.values.starts_on,
      ends_on: termDraft.values.ends_on,
      is_current: termDraft.values.is_current === 'true',
    };
    try {
      if (termDraft.code) await adminApi.updateTerm(termDraft.code, body);
      else await adminApi.createTerm({ ...body, code: termDraft.values.code });
      toast.success(termDraft.code ? 'Term updated' : 'Term created');
      terms.reload();
      setTermDraft(null);
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save the term.';
      setFormError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const saveEnrollment = async () => {
    if (!enrolDraft) return;
    setSaving(true);
    setFormError(null);
    try {
      await adminApi.createEnrollment({
        student_id: enrolDraft.values.student_id,
        course_id: enrolDraft.values.course_id,
        term_code: enrolDraft.values.term_code,
        status: enrolDraft.values.status,
      });
      toast.success('Student enrolled', 'The timetable for that student now includes the course sessions.');
      enrollments.reload();
      setEnrolDraft(null);
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not create the enrolment.';
      setFormError(message);
      toast.error('Enrolment failed', message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === 'courses') await adminApi.deleteCourse(pendingDelete.id);
      if (pendingDelete.kind === 'terms') await adminApi.deleteTerm(pendingDelete.id);
      if (pendingDelete.kind === 'enrollments') await adminApi.deleteEnrollment(pendingDelete.id);
      toast.success('Removed');
      courses.reload();
      terms.reload();
      enrollments.reload();
    } catch (caught) {
      toast.error('Delete failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Timetable entries may still reference this record.');
    } finally {
      setPendingDelete(null);
    }
  };

  const courseColumns: Column<Course>[] = [
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono font-medium text-ink-800">{row.code}</span> },
    { key: 'title', header: 'Course', render: (row) => row.title },
    { key: 'department', header: 'Department', render: (row) => row.department ?? '—' },
    { key: 'credits', header: 'Credits', align: 'right', render: (row) => <span className="tnum">{row.credits}</span> },
    { key: 'level', header: 'Level', render: (row) => <Badge tone="neutral">{row.level ?? 'undergraduate'}</Badge> },
    {
      key: 'staff',
      header: 'Teaching staff',
      render: (row) => <span className="text-[12.5px] text-ink-500">{row.staff?.length ? row.staff.map((member) => member.name).join(', ') : '—'}</span>,
    },
  ];

  const termColumns: Column<Term>[] = [
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono font-medium text-ink-800">{row.code}</span> },
    { key: 'name', header: 'Term', render: (row) => row.name },
    { key: 'range', header: 'Dates', render: (row) => `${row.starts_on} → ${row.ends_on}` },
    { key: 'current', header: 'Status', render: (row) => (row.is_current ? <Badge tone="success">current</Badge> : <span className="text-[12px] text-ink-400">archived</span>) },
  ];

  const enrolmentColumns: Column<Enrollment>[] = [
    { key: 'student', header: 'Student', render: (row) => <span className="font-medium text-ink-800">{row.student_name ?? row.student_id.slice(0, 8)}</span> },
    { key: 'course', header: 'Course', render: (row) => <span className="font-mono text-[12.5px]">{row.course_code ?? row.course_id.slice(0, 8)}</span> },
    { key: 'title', header: 'Title', render: (row) => row.course_title ?? '—' },
    { key: 'term', header: 'Term', render: (row) => <span className="font-mono text-[12.5px]">{row.term_code}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={row.status === 'enrolled' ? 'success' : 'neutral'}>{row.status}</Badge> },
  ];

  const timetableColumns: Column<TimetableEntry>[] = [
    { key: 'day', header: 'Day', render: (row) => dayName(row.day_of_week) },
    { key: 'time', header: 'Time', render: (row) => `${row.starts_at.slice(0, 5)}–${row.ends_at.slice(0, 5)}` },
    { key: 'course', header: 'Course', render: (row) => <span className="font-mono text-[12.5px] font-medium text-ink-800">{row.course_code}</span> },
    { key: 'title', header: 'Session', render: (row) => row.course_title },
    { key: 'room', header: 'Room', render: (row) => (row.room_code ? `${row.building_code ?? ''} · ${row.room_code}` : 'unassigned') },
    { key: 'lecturer', header: 'Lecturer', render: (row) => row.lecturer ?? '—' },
    { key: 'enrolled', header: 'Enrolled', align: 'right', render: (row) => <span className="tnum">{row.enrolled ?? '—'}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Academics"
        description="Courses, terms, enrolments and the master timetable. Student timetables are derived from these records — never hand-edited."
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'courses', label: 'Courses', count: courseOptions.length },
            { value: 'terms', label: 'Terms', count: termOptions.length },
            { value: 'enrollments', label: 'Enrolments', count: enrollments.data?.items.length },
            { value: 'timetable', label: 'Master timetable', count: timetable.data?.entries.length },
          ]}
        />
      </div>

      {tab === 'courses' ? (
        <ResourceTable
          rows={courseOptions}
          columns={courseColumns}
          loading={courses.loading}
          error={courses.error}
          onRetry={courses.reload}
          emptyTitle="No courses"
          emptyDescription="Create a course, then add timetable sessions from the staff timetable screen."
          search={{ value: search, onChange: setSearch, placeholder: 'Search courses' }}
          onCreate={() => openCourse()}
          createLabel="New course"
          rowActions={(row) => (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => openCourse(row)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'courses', id: row.id, label: row.code })}>
                Remove
              </Button>
            </div>
          )}
        />
      ) : null}

      {tab === 'terms' ? (
        <ResourceTable
          rows={termOptions}
          columns={termColumns}
          loading={terms.loading}
          error={terms.error}
          onRetry={terms.reload}
          emptyTitle="No terms"
          emptyDescription="Terms anchor the timetable and enrolments."
          onCreate={() =>
            setTermDraft({ values: { code: '', name: '', starts_on: new Date().toISOString().slice(0, 10), ends_on: new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10), is_current: 'false' } })
          }
          createLabel="New term"
          rowActions={(row) => (
            <div className="flex justify-end gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setTermDraft({ code: row.code, values: { code: row.code, name: row.name, starts_on: row.starts_on.slice(0, 10), ends_on: row.ends_on.slice(0, 10), is_current: String(row.is_current) } })
                }
              >
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'terms', id: row.code, label: row.code })}>
                Remove
              </Button>
            </div>
          )}
        />
      ) : null}

      {tab === 'enrollments' ? (
        <ResourceTable
          rows={enrollments.data?.items ?? []}
          columns={enrolmentColumns}
          loading={enrollments.loading}
          error={enrollments.error}
          onRetry={enrollments.reload}
          emptyTitle="No enrolments"
          emptyDescription="Enrol a student to generate their personal timetable."
          search={{ value: search, onChange: setSearch, placeholder: 'Search by student or course' }}
          onCreate={() => setEnrolDraft({ values: { student_id: studentOptions[0]?.id ?? '', course_id: courseOptions[0]?.id ?? '', term_code: termOptions.find((term) => term.is_current)?.code ?? termOptions[0]?.code ?? '', status: 'enrolled' } })}
          createLabel="Enrol student"
          rowActions={(row) => (
            <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'enrollments', id: row.id, label: `${row.student_name ?? 'student'} · ${row.course_code ?? 'course'}` })}>
              Remove
            </Button>
          )}
        />
      ) : null}

      {tab === 'timetable' ? (
        <div className="space-y-4">
          <Card>
            <SectionHeading title="Filter" description="The master timetable is edited by staff from the Timetable screen; administrators review it here." />
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-48">
                <Field label="Term" htmlFor="tt-term">
                  <Select id="tt-term" value={timetableTerm} onChange={(event) => setTimetableTerm(event.target.value)}>
                    <option value="">All terms</option>
                    {termOptions.map((term) => (
                      <option key={term.code} value={term.code}>
                        {term.code}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="w-44">
                <Field label="Day" htmlFor="tt-day">
                  <Select id="tt-day" value={timetableDay} onChange={(event) => setTimetableDay(event.target.value)}>
                    <option value="">Every day</option>
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                      <option key={day} value={String(day)}>
                        {dayName(day)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </Card>

          <ResourceTable
            rows={timetable.data?.entries ?? []}
            columns={timetableColumns}
            loading={timetable.loading}
            error={timetable.error}
            onRetry={timetable.reload}
            emptyTitle="No sessions"
            emptyDescription="Staff can publish sessions from the timetabling screen."
          />
        </div>
      ) : null}

      <Modal
        open={courseDraft !== null}
        onClose={() => setCourseDraft(null)}
        title={courseDraft?.id ? 'Edit course' : 'New course'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCourseDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveCourse()}>
              Save course
            </Button>
          </>
        }
      >
        {courseDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" htmlFor="course-code" error={formError}>
              <Input id="course-code" value={courseDraft.values.code} onChange={(event) => setCourseDraft({ ...courseDraft, values: { ...courseDraft.values, code: event.target.value } })} />
            </Field>
            <Field label="Title" htmlFor="course-title">
              <Input id="course-title" value={courseDraft.values.title} onChange={(event) => setCourseDraft({ ...courseDraft, values: { ...courseDraft.values, title: event.target.value } })} />
            </Field>
            <Field label="Department" htmlFor="course-department">
              <Input id="course-department" value={courseDraft.values.department} onChange={(event) => setCourseDraft({ ...courseDraft, values: { ...courseDraft.values, department: event.target.value } })} />
            </Field>
            <Field label="Credits" htmlFor="course-credits">
              <Input id="course-credits" value={courseDraft.values.credits} onChange={(event) => setCourseDraft({ ...courseDraft, values: { ...courseDraft.values, credits: event.target.value } })} />
            </Field>
            <Field label="Level" htmlFor="course-level">
              <Select id="course-level" value={courseDraft.values.level} onChange={(event) => setCourseDraft({ ...courseDraft, values: { ...courseDraft.values, level: event.target.value } })}>
                {['foundation', 'undergraduate', 'postgraduate'].map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Colour" htmlFor="course-colour" hint="Used on the timetable grid.">
              <Input id="course-colour" value={courseDraft.values.colour} onChange={(event) => setCourseDraft({ ...courseDraft, values: { ...courseDraft.values, colour: event.target.value } })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="course-description">
                <Textarea id="course-description" rows={2} value={courseDraft.values.description} onChange={(event) => setCourseDraft({ ...courseDraft, values: { ...courseDraft.values, description: event.target.value } })} />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={termDraft !== null}
        onClose={() => setTermDraft(null)}
        title={termDraft?.code ? 'Edit term' : 'New term'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTermDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveTerm()}>
              Save term
            </Button>
          </>
        }
      >
        {termDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" htmlFor="term-code" error={formError} hint="e.g. 2026-FALL.">
              <Input id="term-code" value={termDraft.values.code} onChange={(event) => setTermDraft({ ...termDraft, values: { ...termDraft.values, code: event.target.value } })} />
            </Field>
            <Field label="Name" htmlFor="term-name">
              <Input id="term-name" value={termDraft.values.name} onChange={(event) => setTermDraft({ ...termDraft, values: { ...termDraft.values, name: event.target.value } })} />
            </Field>
            <Field label="Starts on" htmlFor="term-start">
              <Input id="term-start" type="date" value={termDraft.values.starts_on} onChange={(event) => setTermDraft({ ...termDraft, values: { ...termDraft.values, starts_on: event.target.value } })} />
            </Field>
            <Field label="Ends on" htmlFor="term-end">
              <Input id="term-end" type="date" value={termDraft.values.ends_on} onChange={(event) => setTermDraft({ ...termDraft, values: { ...termDraft.values, ends_on: event.target.value } })} />
            </Field>
            <Field label="Current term" htmlFor="term-current" hint="Only one term should be current.">
              <Select id="term-current" value={termDraft.values.is_current} onChange={(event) => setTermDraft({ ...termDraft, values: { ...termDraft.values, is_current: event.target.value } })}>
                <option value="true">Current</option>
                <option value="false">Archived / upcoming</option>
              </Select>
            </Field>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={enrolDraft !== null}
        onClose={() => setEnrolDraft(null)}
        title="Enrol a student"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEnrolDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveEnrollment()} disabled={!enrolDraft?.values.student_id || !enrolDraft?.values.course_id}>
              Enrol
            </Button>
          </>
        }
      >
        {enrolDraft ? (
          <div className="grid gap-4">
            <Field label="Student" htmlFor="enrol-student" error={formError}>
              <Select id="enrol-student" value={enrolDraft.values.student_id} onChange={(event) => setEnrolDraft({ values: { ...enrolDraft.values, student_id: event.target.value } })}>
                <option value="">Select a student…</option>
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} · {student.registration_no ?? student.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Course" htmlFor="enrol-course">
              <Select id="enrol-course" value={enrolDraft.values.course_id} onChange={(event) => setEnrolDraft({ values: { ...enrolDraft.values, course_id: event.target.value } })}>
                <option value="">Select a course…</option>
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} · {course.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Term" htmlFor="enrol-term">
              <Select id="enrol-term" value={enrolDraft.values.term_code} onChange={(event) => setEnrolDraft({ values: { ...enrolDraft.values, term_code: event.target.value } })}>
                {termOptions.map((term) => (
                  <option key={term.code} value={term.code}>
                    {term.code} {term.is_current ? '· current' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="enrol-status">
              <Select id="enrol-status" value={enrolDraft.values.status} onChange={(event) => setEnrolDraft({ values: { ...enrolDraft.values, status: event.target.value } })}>
                {['enrolled', 'completed', 'dropped'].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this record?"
        message={pendingDelete ? `“${pendingDelete.label}” will be removed. Timetable sessions referencing it must be deleted first.` : ''}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
