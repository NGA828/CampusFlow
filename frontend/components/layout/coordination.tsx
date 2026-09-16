import type { ReactNode } from "react";
import { Button, CardSkeleton, ErrorState } from "@/components/ui/kit";
import s from "./coordination.module.css";
export function CoordinationHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className={s.header}>
      <div>
        <p className={s.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className={s.actions}>{children}</div>
    </header>
  );
}
export function ReadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
}) {
  return error ? (
    <ErrorState message={error} onRetry={retry} />
  ) : loading ? (
    <div aria-busy="true" aria-label="Loading workspace">
      <CardSkeleton rows={5} />
      <span className="sr-only" role="status">
        Loading workspace
      </span>
    </div>
  ) : null;
}
export function Feedback({
  value,
}: {
  value: { error: boolean; text: string } | null;
}) {
  return value ? (
    <p
      className={s.status}
      data-error={value.error}
      role={value.error ? "alert" : "status"}
    >
      {value.text}
    </p>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Pager({
  page,
  pages,
  total,
  busy,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  busy: boolean;
  onPage: (p: number) => void;
}) {
  return (
    <nav className={s.pagination} aria-label="Result pages">
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        {total} results · Page {page} of {pages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
export function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <div className={s.metric}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <small>{hint}</small>
    </div>
  );
}
