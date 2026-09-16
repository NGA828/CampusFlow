'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { authApi } from '@/lib/api/endpoints';
import type { User } from '@/lib/api/types';
import { Button, CardSkeleton, Field, Input } from '@/components/ui/kit';
import { useToast } from '@/components/ui/toast';
import { WorkspaceIcon } from '@/components/layout/workspace-visual';
import { CompanionHeading, Feedback, errorMessage, momentLabel } from '@/components/layout/student-companion';
import s from '@/components/layout/student-companion.module.css';

export default function AccountPage() {
  const { user } = useAuth();
  return user ? <AccountSettings key={user.id} user={user} /> : <CardSkeleton rows={8} />;
}

function AccountSettings({ user }: { user: User }) {
  const { saveProfile, logout, assignments } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [department, setDepartment] = useState(user.department ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<{ error?: boolean; message: string } | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const lock = useRef(false);
  const changed = name.trim() !== user.name || phone.trim() !== (user.phone ?? '') || department.trim() !== (user.department ?? '');

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !name.trim()) return;
    lock.current = true; setBusy('profile'); setProfileFeedback(null);
    try {
      const saved = await saveProfile({ name: name.trim(), phone: phone.trim() || null, department: department.trim() || null });
      setName(saved.name); setPhone(saved.phone ?? ''); setDepartment(saved.department ?? '');
      setProfileFeedback({ message: 'Your profile changes have been saved.' });
    } catch (error) {
      setProfileFeedback({ error: true, message: errorMessage(error, 'Your profile could not be saved. Your edits are still here.') });
    } finally { lock.current = false; setBusy(null); }
  }
  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (password !== confirm) { setPasswordError('The two passwords do not match.'); return; }
    lock.current = true; setBusy('password'); setPasswordError(null);
    try {
      const result = await authApi.changePassword({ current_password: currentPassword, password, password_confirmation: confirm });
      if (result.changed !== true) throw new Error('The server did not confirm the password change.');
      setCurrentPassword(''); setPassword(''); setConfirm('');
      toast.success('Password changed', 'Sign in again with your new password.');
      await logout();
    } catch (error) { setPasswordError(errorMessage(error, 'Your password could not be changed.')); }
    finally { lock.current = false; setBusy(null); }
  }
  async function signOut() {
    if (lock.current) return;
    lock.current = true; setBusy('logout');
    try { await logout(); } finally { lock.current = false; setBusy(null); }
  }
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
  return <div className={s.page}>
    <CompanionHeading eyebrow="Your workspace · personal settings" title="Your account" description="The details that keep your campus life connected." actions={<Button variant="secondary" disabled={!!busy} loading={busy === 'logout'} onClick={() => void signOut()}>Sign out</Button>} />
    <section className={s.identity} aria-label="Account identity">
      <div className={s.avatar} aria-hidden="true">{initials}</div>
      <div><p className={s.eyebrow}>{user.role_code} account</p><h2>{user.name}</h2><p>{user.email}</p></div>
      <span className={s.status}>{user.status ?? 'Status not provided'}</span>
    </section>
    <div className={s.settingsLayout}>
      <nav className={s.settingsNav} aria-label="Account sections">
        <a href="#personal"><WorkspaceIcon name="eye" size={18} />Personal details</a>
        <a href="#security"><WorkspaceIcon name="shield" size={18} />Security</a>
        <a href="#access"><WorkspaceIcon name="grid" size={18} />Workspace access</a>
        <p>Your role and access are managed by campus administration. Changes here apply only to your own profile.</p>
      </nav>
      <div>
        <section id="personal" className={s.settingsSection} aria-labelledby="personal-title">
          <div className={s.sectionIntro}><span className={s.sectionNo}>01</span><div><h2 id="personal-title">Personal details</h2><p>Keep your contact details current so campus offices can reach you.</p></div></div>
          <div className={s.panel}>
            <dl className={s.readOnly}><div><dt>Campus email · read only</dt><dd>{user.email}</dd></div><div><dt>Registration number · read only</dt><dd>{user.registration_no ?? 'Not provided'}</dd></div></dl>
            <form onSubmit={submitProfile} aria-label="Personal details">
              <fieldset disabled={!!busy} className={s.formGrid}>
                <Field label="Full name" htmlFor="account-name"><Input id="account-name" autoComplete="name" required maxLength={255} value={name} onChange={e => { setName(e.target.value); setProfileFeedback(null); }} /></Field>
                <Field label="Phone number" htmlFor="account-phone"><Input id="account-phone" type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={e => { setPhone(e.target.value); setProfileFeedback(null); }} placeholder="Optional contact number" /></Field>
                <Field label="Department" htmlFor="account-department"><Input id="account-department" maxLength={120} value={department} onChange={e => { setDepartment(e.target.value); setProfileFeedback(null); }} placeholder="Your department" /></Field>
              </fieldset>
              {profileFeedback && <Feedback error={profileFeedback.error}>{profileFeedback.message}</Feedback>}
              <div className={s.formFooter}><p>Contact campus administration to update your campus email or registration number.</p><Button type="submit" disabled={!!busy || !changed || !name.trim()} loading={busy === 'profile'}>Save changes</Button></div>
            </form>
          </div>
        </section>
        <section id="security" className={s.settingsSection} aria-labelledby="security-title">
          <div className={s.sectionIntro}><span className={s.sectionNo}>02</span><div><h2 id="security-title">Password & security</h2><p>Use at least 8 characters. A long, unique password is recommended.</p></div></div>
          <form onSubmit={submitPassword} className={s.panel} aria-label="Change password">
            <fieldset disabled={!!busy} className={s.formGrid}>
              <Field label="Current password" htmlFor="account-current"><Input id="account-current" type="password" required autoComplete="current-password" value={currentPassword} onChange={e => { setCurrentPassword(e.target.value); setPasswordError(null); }} /></Field>
              <Field label="New password" htmlFor="account-new"><Input id="account-new" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); setPasswordError(null); }} /></Field>
              <Field label="Confirm new password" htmlFor="account-confirm"><Input id="account-confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e => { setConfirm(e.target.value); setPasswordError(null); }} /></Field>
            </fieldset>
            {passwordError && <Feedback error>{passwordError}</Feedback>}
            <div className={s.formFooter}><p>This signs you out on all devices, including this browser. You’ll need your new password to sign in again.</p><Button type="submit" disabled={!!busy || !currentPassword || password.length < 8 || !confirm} loading={busy === 'password'}>Change password & sign out</Button></div>
          </form>
        </section>
        <section id="access" className={s.settingsSection} aria-labelledby="access-title">
          <div className={s.sectionIntro}><span className={s.sectionNo}>03</span><div><h2 id="access-title">Workspace access</h2><p>Read-only access supplied by the campus system.</p></div></div>
          <div className={s.panel}>
            <dl className={s.readOnly}><div><dt>Role</dt><dd>{user.role_code}</dd></div><div><dt>Member since</dt><dd>{momentLabel(user.created_at)}</dd></div></dl>
            {user.role_code !== 'student' && <div><h3>Assigned scopes · {assignments.length}</h3>{assignments.length ? assignments.map(assignment => <div key={assignment.id} className={s.assignment}><strong>{assignment.scope_label ?? assignment.scope_name ?? assignment.scope_id}</strong><p className={s.muted}>{assignment.scope_type} · {assignment.role_in_scope}</p><div className={s.pills}>{assignment.can_call_tickets && <span>Call tickets</span>}{assignment.can_manage_timetable && <span>Manage timetable</span>}{assignment.can_publish_content && <span>Publish content</span>}</div></div>) : <p className={s.muted}>No scopes are assigned to this account.</p>}</div>}
            <details className={s.details}><summary>Session permissions · {user.permissions?.length ?? 0}</summary>{user.permissions?.length ? <div className={s.pills}>{user.permissions.map(permission => <span key={permission}>{permission}</span>)}</div> : <p className={s.muted}>No permission list was supplied for this session.</p>}</details>
            <details className={s.details}><summary>Notifications on this browser</summary><p className={s.muted}>Read campus updates in your notification inbox. Browser push delivery is not currently configured; no device token is registered here.</p><Link className={s.link} href="/notifications">Open notification inbox <WorkspaceIcon name="arrow" size={16} /></Link></details>
          </div>
        </section>
      </div>
    </div>
  </div>;
}
