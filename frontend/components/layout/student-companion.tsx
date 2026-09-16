import type { ReactNode } from 'react';
import { ErrorState } from '@/components/ui/kit';
import s from './student-companion.module.css';

export function CompanionHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className={s.heading}><div><p className={s.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{actions ? <div className={s.actions}>{actions}</div> : null}</header>;
}
export function ReadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert"><ErrorState message={message} onRetry={retry} /></div>;
}
export function Feedback({ error, children }: { error?: boolean; children: ReactNode }) {
  return <p role={error ? 'alert' : 'status'} className={error ? s.error : s.feedback}>{children}</p>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className={s.empty}><span aria-hidden="true" className={s.emptyMark}>—</span><h3>{title}</h3><p>{children}</p></div>;
}
export function momentLabel(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not provided';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
export function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'firstError' in error && typeof error.firstError === 'string') return error.firstError;
  return error instanceof Error ? error.message : fallback;
}
