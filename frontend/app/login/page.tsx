'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button, Field, Input } from '@/components/ui/kit';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/client';
import { WorkspaceBrand, WorkspaceIcon } from '@/components/layout/workspace-visual';
import styles from '@/components/layout/workspace.module.css';

const DEMO_ACCOUNTS = [
  { role: 'Student', email: 'student@campusflow.edu', hint: 'Alex Rivera · Computer Science' },
  { role: 'Staff', email: 'staff@campusflow.edu', hint: 'Dr. Jane Smith · Computer Science' },
  { role: 'Administrator', email: 'admin@campusflow.edu', hint: 'System Administrator · IT Operations' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError(null);
    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      router.replace(user.role_code === 'admin' ? '/admin/dashboard' : user.role_code === 'staff' ? '/staff/dashboard' : '/student/dashboard');
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Sign in failed. Please try again.');
    } finally { setLoading(false); }
  };

  return <main className={styles.auth}>
    <section className={styles.authStory} aria-label="Welcome to CampusFlow">
      <WorkspaceBrand />
      <div className={styles.routeEntrance}>
        <div className={styles.eyebrow}>One campus. So many possibilities.</div>
        <h2>Your campus.<br />A little more connected.</h2>
        <p>From your next class to the services that keep campus moving. Make room for a simpler day.</p>
        <Image src="/images/campus-workspace.webp" width={1100} height={733} alt="" className={styles.authArt} sizes="(max-width:767px) 1px, 50vw" preload />
      </div>
      <div className={styles.authStoryFooter}><span>01 · Plan your week</span><span>02 · Explore campus</span><span>03 · Find your services</span></div>
    </section>
    <section className={styles.authForm} aria-label="Sign in">
      <div className={`${styles.authFormInner} ${styles.routeEntrance}`}>
        <div className={styles.mobileBrand}><WorkspaceBrand /></div>
        <div className={styles.eyebrow}>Your day starts here</div>
        <h1>Welcome back.</h1>
        <p className={styles.authFormIntro}>Sign in with your campus account.<br />We’ll take you to your own workspace.</p>
        <form onSubmit={submit} className="space-y-5">
          <Field label="Email address" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@campusflow.edu" /></Field>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="password" className="text-[13px] font-medium text-ink-700">Password</label><Link href="/forgot-password" className="text-[12px] font-semibold text-brand-600 hover:underline">Forgot password?</Link></div>
            <div className={styles.passwordControl}><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /><button type="button" className={styles.passwordToggle} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}><WorkspaceIcon name={showPassword ? 'eye-off' : 'eye'} size={19} /></button></div>
          </div>
          {error ? <p role="alert" className={styles.authError}>{error}</p> : null}
          <Button type="submit" size="lg" loading={loading} className="w-full">Sign in <WorkspaceIcon name="arrow" size={18} /></Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-ink-500">New to CampusFlow? <Link href="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link></p>
        <details className={styles.demo}><summary>Explore with a demo account</summary><p className="mt-2 text-[11px] leading-relaxed text-ink-500">For seeded deployments only. Password: <span className="font-mono">password123</span></p><div className="mt-2">{DEMO_ACCOUNTS.map((account) => <button key={account.email} type="button" aria-label={`Use ${account.role} demo account`} onClick={() => { setEmail(account.email); setPassword('password123'); setError(null); }}><span><strong className="block text-ink-800">{account.role}</strong><span className="text-[11px] text-ink-500">{account.hint}</span></span><WorkspaceIcon name="arrow" size={16} /></button>)}</div></details>
        <p className="mt-7 flex items-center justify-center gap-2 text-[11px] text-ink-500"><WorkspaceIcon name="shield" size={15} />Your account. Your campus workspace.</p>
      </div>
    </section>
  </main>;
}
