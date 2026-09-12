'use client';

import { useState } from 'react';
import { useAsync, useDebounced, relativeTime } from '@/lib/hooks';
import { adminApi, campusApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, Card, ConfirmDialog, Field, Input, Modal, SectionHeading, Select, Tabs } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { ResourceTable, type Column } from '@/components/admin/table';
import { useToast } from '@/components/ui/toast';
import type { AdminUser, PageMeta } from '@/lib/api/types';

const ROLES = ['student', 'staff', 'admin', 'visitor'] as const;

export default function AdminUsersPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'users' | 'assignments'>('users');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [draft, setDraft] = useState({ name: '', email: '', role_code: 'student', registration_no: '', department: '', password: '' });
  const [assignment, setAssignment] = useState({ user_id: '', scope_type: 'building', scope_id: '', role_in_scope: 'staff', can_manage_timetable: false, can_publish_content: false, can_call_tickets: true });

  const users = useAsync(
    () => adminApi.users({ q: debounced || undefined, role_code: role || undefined, page, per_page: 25 }),
    [debounced, role, page],
  );
  const assignments = useAsync(() => adminApi.staffAssignments(), []);
  const buildings = useAsync(() => campusApi.buildings(), []);

  const create = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const result = await adminApi.createUser({
        name: draft.name,
        email: draft.email,
        role_code: draft.role_code,
        registration_no: draft.registration_no || undefined,
        department: draft.department || undefined,
        password: draft.password || undefined,
      });
      toast.success('User created', result.password ? `Temporary password: ${result.password}` : undefined);
      setCreateOpen(false);
      setDraft({ name: '', email: '', role_code: 'student', registration_no: '', department: '', password: '' });
      users.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not create the user.';
      setFormError(message);
      toast.error('Create failed', message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    setFormError(null);
    try {
      // The role goes to its own endpoint, and only when it actually moved: a role change is an
      // authorisation event with an audit trail, not a text field on a profile.
      const before = (users.data?.items ?? []).find((row) => row.id === editUser.id)?.role_code;
      if (before && before !== editUser.role_code) await adminApi.setUserRole(editUser.id, editUser.role_code);
      await adminApi.updateUser(editUser.id, { status: editUser.status, department: editUser.department });
      toast.success('User updated');
      setEditUser(null);
      users.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not update the user.';
      setFormError(message);
      toast.error('Update failed', message);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (user: AdminUser) => {
    try {
      const result = await adminApi.resetUserPassword(user.id);
      setResetResult({ name: user.name, password: result.password });
      toast.success('Password reset', 'Share the temporary password securely.');
    } catch (caught) {
      toast.error('Reset failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Try again.');
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await adminApi.deleteUser(pendingDelete.id);
      toast.success('User deactivated');
      users.reload();
    } catch (caught) {
      toast.error('Delete failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Try again.');
    } finally {
      setPendingDelete(null);
    }
  };

  const addAssignment = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await adminApi.createAssignment({
        user_id: assignment.user_id,
        scope_type: assignment.scope_type,
        scope_id: assignment.scope_id,
        role_in_scope: assignment.role_in_scope,
        can_manage_timetable: assignment.can_manage_timetable,
        can_publish_content: assignment.can_publish_content,
        can_call_tickets: assignment.can_call_tickets,
      });
      toast.success('Assignment added', 'The staff member can now operate that scope.');
      setAssignmentOpen(false);
      assignments.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not add the assignment.';
      setFormError(message);
      toast.error('Assignment failed', message);
    } finally {
      setSaving(false);
    }
  };

  const userColumns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'User',
      render: (user) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-800">{user.name}</p>
          <p className="truncate text-[12px] text-ink-500">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => <Badge tone={user.role_code === 'admin' ? 'danger' : user.role_code === 'staff' ? 'brand' : 'neutral'}>{user.role_code}</Badge>,
    },
    { key: 'registration', header: 'Registration', render: (user) => <span className="font-mono text-[12px]">{user.registration_no ?? '—'}</span> },
    { key: 'department', header: 'Department', render: (user) => user.department ?? '—' },
    {
      key: 'assignments',
      header: 'Scopes',
      render: (user) => (
        <span className="tnum text-[12.5px] text-ink-500">
          {user.assignments?.length ?? 0} assignment{(user.assignments?.length ?? 0) === 1 ? '' : 's'}
          {user.active_tokens ? ` · ${user.active_tokens} sessions` : ''}
        </span>
      ),
    },
    { key: 'last_login', header: 'Last active', render: (user) => <span className="text-[12.5px] text-ink-500">{user.last_login_at ? relativeTime(user.last_login_at) : 'never'}</span> },
  ];

  const meta = (users.data as unknown as { meta?: PageMeta } | undefined)?.meta;

  return (
    <div>
      <PageHeader
        title="Users & roles"
        description="Accounts, roles, and the scopes that let staff operate queues, offices, timetables and content."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            New user
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'users', label: 'Users', count: meta?.total },
            { value: 'assignments', label: 'Staff assignments', count: assignments.data?.assignments.length },
          ]}
        />
      </div>

      {tab === 'users' ? (
        <ResourceTable
          rows={users.data?.items ?? []}
          columns={userColumns}
          loading={users.loading}
          error={users.error}
          onRetry={users.reload}
          emptyTitle="No users match"
          emptyDescription="Adjust the search or role filter."
          search={{ value: search, onChange: setSearch, placeholder: 'Search name, email or registration number' }}
          filters={
            <div className="w-40">
              <Select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filter by role">
                <option value="">All roles</option>
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
          }
          meta={meta}
          onPage={setPage}
          rowActions={(user) => (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setEditUser({ ...user })}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void resetPassword(user)}>
                Reset password
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete(user)}>
                Deactivate
              </Button>
            </div>
          )}
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <SectionHeading
              title="Assign a scope"
              description="Scopes decide which queues, offices and timetables a staff member can operate."
              action={
                <Button size="sm" onClick={() => setAssignmentOpen(true)}>
                  Add assignment
                </Button>
              }
            />
            {(assignments.data?.assignments.length ?? 0) === 0 ? (
              <p className="text-[13px] text-ink-500">No staff assignments exist yet.</p>
            ) : (
              <ul className="divide-y divide-ink-50">
                {assignments.data?.assignments.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-800">
                        {item.user_name ?? item.user_id} · {item.scope_name ?? item.scope_label ?? item.scope_type}
                      </p>
                      <p className="text-[12px] text-ink-500">
                        {item.role_in_scope} · {[item.can_manage_timetable ? 'timetable' : null, item.can_publish_content ? 'content' : null, item.can_call_tickets ? 'tickets' : null].filter(Boolean).join(', ') || 'no extra rights'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await adminApi.deleteAssignment(item.id);
                          toast.success('Assignment removed');
                          assignments.reload();
                        } catch {
                          toast.error('Could not remove the assignment');
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a user"
        description="A temporary password is generated unless you set one."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void create()} disabled={draft.name.length < 2 || !draft.email.includes('@')}>
              Create user
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="new-name" error={formError}>
            <Input id="new-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="Email" htmlFor="new-email">
            <Input id="new-email" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          </Field>
          <Field label="Role" htmlFor="new-role">
            <Select id="new-role" value={draft.role_code} onChange={(event) => setDraft({ ...draft, role_code: event.target.value })}>
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Registration number" htmlFor="new-registration" hint="Students only.">
            <Input id="new-registration" value={draft.registration_no} onChange={(event) => setDraft({ ...draft, registration_no: event.target.value })} />
          </Field>
          <Field label="Department" htmlFor="new-department">
            <Input id="new-department" value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })} />
          </Field>
          <Field label="Password" htmlFor="new-password" hint="Leave blank to auto-generate.">
            <Input id="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title="Edit user"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveEdit()}>
              Save changes
            </Button>
          </>
        }
      >
        {editUser ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" htmlFor="edit-role" error={formError}>
              <Select id="edit-role" value={editUser.role_code} onChange={(event) => setEditUser({ ...editUser, role_code: event.target.value as AdminUser['role_code'] })}>
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="edit-status">
              <Select id="edit-status" value={editUser.status} onChange={(event) => setEditUser({ ...editUser, status: event.target.value })}>
                {['active', 'suspended', 'inactive'].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Department" htmlFor="edit-department">
                <Input id="edit-department" value={editUser.department ?? ''} onChange={(event) => setEditUser({ ...editUser, department: event.target.value })} />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        title="Add a staff assignment"
        description="Scope types map to buildings, rooms, offices and queues."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignmentOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void addAssignment()} disabled={!assignment.user_id || !assignment.scope_id}>
              Add assignment
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Staff member" htmlFor="assignment-user" error={formError}>
              <Select id="assignment-user" value={assignment.user_id} onChange={(event) => setAssignment({ ...assignment, user_id: event.target.value })}>
                <option value="">Select a user…</option>
                {(users.data?.items ?? [])
                  .filter((user) => user.role_code === 'staff' || user.role_code === 'admin')
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {user.role_code}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field label="Scope type" htmlFor="assignment-scope-type">
            <Select id="assignment-scope-type" value={assignment.scope_type} onChange={(event) => setAssignment({ ...assignment, scope_type: event.target.value, scope_id: '' })}>
              {['building', 'room', 'office', 'queue'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Scope" htmlFor="assignment-scope-id" hint={assignment.scope_type === 'building' ? 'Pick a building' : 'Paste the scope id (room/office/queue)'}>
            {assignment.scope_type === 'building' ? (
              <Select id="assignment-scope-id" value={assignment.scope_id} onChange={(event) => setAssignment({ ...assignment, scope_id: event.target.value })}>
                <option value="">Select a building…</option>
                {(buildings.data?.buildings ?? []).map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.code} · {building.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id="assignment-scope-id" value={assignment.scope_id} onChange={(event) => setAssignment({ ...assignment, scope_id: event.target.value })} placeholder="UUID" />
            )}
          </Field>
          <Field label="Role in scope" htmlFor="assignment-role">
            <Input id="assignment-role" value={assignment.role_in_scope} onChange={(event) => setAssignment({ ...assignment, role_in_scope: event.target.value })} />
          </Field>
          <div className="sm:col-span-2 flex flex-wrap gap-4">
            {(
              [
                ['can_call_tickets', 'Call tickets'],
                ['can_manage_timetable', 'Timetable'],
                ['can_publish_content', 'Publish content'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[13px] text-ink-700">
                <input
                  type="checkbox"
                  checked={assignment[key]}
                  onChange={(event) => setAssignment({ ...assignment, [key]: event.target.checked })}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={resetResult !== null} onClose={() => setResetResult(null)} title="Temporary password" footer={<Button onClick={() => setResetResult(null)}>Done</Button>}>
        {resetResult ? (
          <div>
            <p className="text-[13px] text-ink-600">
              A new temporary password was issued for <strong className="font-semibold">{resetResult.name}</strong>. It is shown once — share it securely.
            </p>
            <p className="mt-3 rounded-[10px] bg-ink-50 px-4 py-3 font-mono text-[15px] tracking-wide text-ink-900">{resetResult.password}</p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Deactivate this user?"
        message={pendingDelete ? `${pendingDelete.name} will no longer be able to sign in. Their records stay intact.` : ''}
        confirmLabel="Deactivate"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
