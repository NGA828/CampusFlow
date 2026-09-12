'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { authApi, meApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, Card, CardSkeleton, Field, Input, KeyValue, SectionHeading } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { useToast } from '@/components/ui/toast';
import { relativeTime } from '@/lib/hooks';

export default function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!user) {
    return (
      <div>
        <PageHeader title="Profile" />
        <CardSkeleton rows={5} />
      </div>
    );
  }

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      await authApi.updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        department: department.trim() || null,
      });
      await refresh();
      toast.success('Profile updated');
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save your profile.';
      setProfileError(message);
      toast.error('Save failed', message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (password !== confirm) {
      setPasswordError('The two passwords do not match.');
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await authApi.changePassword({ current_password: currentPassword, password });
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
      toast.success('Password changed', 'Other sessions were signed out.');
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not change your password.';
      setPasswordError(message);
      toast.error('Password change failed', message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your account details, role and security settings."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeading title="Your details" description="Keep your contact information current so offices can reach you." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name" error={profileError}>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Email" htmlFor="email" hint="Contact the registrar to change your campus email.">
                <Input id="email" value={user.email} readOnly className="bg-ink-50 text-ink-500" />
              </Field>
              <Field label="Phone" htmlFor="phone">
                <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 0100" />
              </Field>
              <Field label="Department" htmlFor="department">
                <Input id="department" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Computer Science" />
              </Field>
            </div>
            <div className="mt-4">
              <Button loading={savingProfile} onClick={() => void saveProfile()}>
                Save changes
              </Button>
            </div>
          </Card>

          <Card>
            <SectionHeading title="Change password" description="Use at least 10 characters with a mix of letters and numbers." />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Current password" htmlFor="current">
                <Input id="current" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </Field>
              <Field label="New password" htmlFor="new" error={passwordError}>
                <Input id="new" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm">
                <Input id="confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
              </Field>
            </div>
            <div className="mt-4">
              <Button loading={savingPassword} onClick={() => void changePassword()} disabled={!currentPassword || password.length < 10 || !confirm}>
                Update password
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Account" />
            <dl className="divide-y divide-ink-50">
              <KeyValue label="Role" value={<Badge tone={user.role_code === 'admin' ? 'danger' : user.role_code === 'staff' ? 'brand' : 'neutral'}>{user.role_code}</Badge>} />
              <KeyValue label="Status" value={user.status} />
              <KeyValue label="Registration no." value={user.registration_no ?? '—'} mono />
              <KeyValue label="Member since" value={relativeTime(user.created_at)} />
              <KeyValue label="Last login" value={user.last_login_at ? relativeTime(user.last_login_at) : '—'} />
            </dl>
          </Card>

          <Card>
            <SectionHeading title="Your staff assignments" description={user.assignments?.length ? undefined : 'No elevated scopes'} />
            {user.assignments && user.assignments.length > 0 ? (
              <ul className="space-y-2">
                {user.assignments.map((assignment) => (
                  <li key={assignment.id} className="rounded-[10px] border border-ink-100 px-3 py-2">
                    <p className="text-[13px] font-medium text-ink-800">
                      {assignment.scope_label ?? assignment.scope_type} · {assignment.role_in_scope}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {assignment.can_manage_timetable ? <Badge tone="neutral">timetable</Badge> : null}
                      {assignment.can_publish_content ? <Badge tone="neutral">content</Badge> : null}
                      {assignment.can_call_tickets ? <Badge tone="neutral">tickets</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-500">Your account holds the standard {user.role_code} permissions.</p>
            )}
          </Card>

          <Card>
            <SectionHeading title="Permissions" description={`${permissions.length} granted`} />
            <div className="flex flex-wrap gap-1.5">
              {permissions.slice(0, 24).map((permission) => (
                <Badge key={permission} tone="neutral">
                  {permission}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeading title="Connected devices" description="Push notifications" />
            <p className="text-[12.5px] leading-relaxed text-ink-600">
              The mobile app registers this device for queue calls and reminders. Web notifications arrive over the live socket while you are signed in.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={async () => {
                if (typeof Notification === 'undefined') {
                  toast.info('Browser notifications are not available here');
                  return;
                }
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                  await meApi.registerDevice({ token: `web-${Math.random().toString(36).slice(2)}`, platform: 'web' }).catch(() => {});
                  toast.success('Notifications enabled');
                } else {
                  toast.info('Notifications stay disabled');
                }
              }}
            >
              Enable browser notifications
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
