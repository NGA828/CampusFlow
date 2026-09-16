"use client";

import { useState } from "react";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import { useAsync, formatDate } from "@/lib/hooks";
import { engagementApi } from "@/lib/api/endpoints";
import type { Announcement } from "@/lib/api/types";
import {
  Badge,
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Input,
} from "@/components/ui/kit";
import { PageHeader } from "@/components/layout/app-shell";
import s from "@/components/layout/student-discovery.module.css";

const filters = [
  ["all", "All notices"],
  ["urgent", "Urgent"],
  ["high", "Important"],
  ["normal", "General"],
] as const;

export default function AnnouncementsPage() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [page, setPage] = useState(1);
  const notices = useAsync(
    () => engagementApi.announcements({ per_page: 30, page }),
    [page],
  );
  const available = !notices.loading && !notices.error;
  const all = available ? (notices.data?.items ?? []) : [];
  const items = all
    .filter(
      (item) =>
        (priority === "all" || item.priority === priority) &&
        `${item.title} ${item.body}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const pinned = items.filter((item) => item.is_pinned);
  const feed = items.filter((item) => !item.is_pinned);
  const meta = notices.data?.meta;
  const reset = () => {
    setSearch("");
    setPriority("all");
  };

  const notice = (item: Announcement) => (
    <article
      key={item.id}
      className={`${s.notice} ${item.is_pinned ? s.pinned : ""}`}
    >
      <div className={s.noticeTop}>
        <Badge
          tone={
            item.priority === "urgent"
              ? "danger"
              : item.priority === "high"
                ? "warning"
                : "neutral"
          }
        >
          {item.priority === "high"
            ? "Important"
            : item.priority === "urgent"
              ? "Urgent"
              : "General"}
        </Badge>
        {item.published_at ? (
          <time dateTime={item.published_at}>
            {formatDate(item.published_at, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        ) : (
          <span>Publication date not listed</span>
        )}
        {item.is_pinned ? (
          <span className="inline-flex items-center gap-1">
            <WorkspaceIcon name="pin" size={12} /> Pinned
          </span>
        ) : null}
      </div>
      <h3>{item.title}</h3>
      {item.body.length > 240 ? (
        <>
          <p className={s.noticeExcerpt}>
            {item.body.slice(0, 240).trimEnd()}…
          </p>
          <details className={s.disclosure}>
            <summary>
              Read full notice<span className="sr-only">: {item.title}</span>
            </summary>
            <p>{item.body}</p>
          </details>
        </>
      ) : (
        <p className={s.noticeExcerpt}>{item.body}</p>
      )}
      <div className={`${s.noticeTop} mt-4`}>
        {item.author_name ? <span>From {item.author_name}</span> : null}
        {item.building_code ? <span>{item.building_code}</span> : null}
        {(item.audience ?? item.target_roles)?.length ? (
          <span>For {(item.audience ?? item.target_roles)!.join(", ")}</span>
        ) : null}
        {item.expires_at ? (
          <span>
            Valid until{" "}
            {formatDate(item.expires_at, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ) : null}
      </div>
    </article>
  );

  return (
    <div className={s.page}>
      <PageHeader
        title="Announcements"
        description="Official updates for your campus community."
      />
      <header className={s.bulletinHeader}>
        <div>
          <p className={s.eyebrow}>The campus bulletin</p>
          <h2>
            Good to know.
            <br />
            Important to you.
          </h2>
          <p className={s.muted}>
            Faculty news, campus notices and the details that keep your day on
            track.
          </p>
        </div>
        <div className={s.bulletinSeal} aria-hidden="true">
          <WorkspaceIcon name="bulletin" size={38} strokeWidth={1.2} />
        </div>
      </header>
      <div className={s.split}>
        <aside className={s.rail} aria-label="Announcement filters">
          <div>
            <h2>Browse notices</h2>
            <p className={s.muted}>In this page of the bulletin</p>
          </div>
          <div className={s.noticeFilters}>
            {filters.map(([value, label]) => (
              <button
                key={value}
                aria-pressed={priority === value}
                onClick={() => setPriority(value)}
              >
                <span>{label}</span>
                <span aria-hidden="true">
                  {available
                    ? all.filter((a) => value === "all" || a.priority === value)
                        .length
                    : "—"}
                </span>
              </button>
            ))}
          </div>
          <div className={s.railNote}>
            <p className="text-sm font-semibold">From official sources</p>
            <p className={s.muted}>
              The campus service decides which notices are relevant to your role
              and department.
            </p>
            <button
              className={s.link}
              onClick={notices.reload}
              disabled={notices.loading}
            >
              Refresh notices
            </button>
          </div>
        </aside>
        <section aria-label="Campus noticeboard" aria-busy={notices.loading}>
          <div className={s.toolbar}>
            <div className={s.search}>
              <Input
                aria-label="Search announcements on this page"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search announcements on this page"
              />
            </div>
            {search || priority !== "all" ? (
              <button className={s.link} onClick={reset}>
                Clear filters
              </button>
            ) : null}
          </div>
          {notices.loading ? (
            <CardSkeleton rows={8} />
          ) : notices.error ? (
            <ErrorState message={notices.error} onRetry={notices.reload} />
          ) : (
            <>
              <p className={`${s.muted} mb-5`} role="status">
                {items.length} notices shown on this page
              </p>
              {pinned.length ? (
                <section aria-label="Pinned notices">
                  <p className={s.sectionLabel}>
                    <WorkspaceIcon name="pin" size={14} /> Pinned to the board
                  </p>
                  {pinned.map(notice)}
                </section>
              ) : null}
              {feed.length ? (
                <section aria-label="Latest notices">
                  <p className={`${s.sectionLabel} mt-7`}>Latest notices</p>
                  {feed.map(notice)}
                </section>
              ) : null}
              {!items.length ? (
                <EmptyState
                  title="No notices in this view"
                  description="Try another priority or clear your search. New notices appear here when published for you."
                  action={
                    <Button variant="secondary" onClick={reset}>
                      Clear filters
                    </Button>
                  }
                />
              ) : null}
              {meta && meta.total_pages > 1 ? (
                <nav className={s.pagination} aria-label="Announcement pages">
                  <span>
                    Page {meta.page} of {meta.total_pages} · {meta.total}{" "}
                    notices
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous page
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= meta.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next page
                    </Button>
                  </div>
                </nav>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
