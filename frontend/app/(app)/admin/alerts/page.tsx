"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/api/endpoints";
import { useOperator } from "@/lib/use-operator";
import { useMediaQuery } from "@/lib/hooks";
import { Button, Textarea } from "@/components/ui/kit";
import { Feedback, ReadState } from "@/components/layout/coordination";
import type { AdminAlert } from "@/lib/api/types";
import s from "./alerts.module.css";

type Filter = "all" | AdminAlert["severity"];
const order = { critical: 0, warning: 1, info: 2 };
const label = {
  all: "All conditions",
  critical: "Critical",
  warning: "Warning",
  info: "Information",
};
const destination: Record<string, string> = {
  "/admin/campus": "Campus management",
  "/admin/services": "Service configuration",
  "/admin/spatial": "Spatial configuration",
  "/admin/users": "People & access",
  "/admin/academics": "Academic management",
  "/admin/settings": "Platform settings",
  "/admin/analytics": "Analytics",
  "/admin/dashboard": "Admin dashboard",
};

export default function AdminAlertsPage() {
  const work = useOperator(useCallback(() => adminApi.alerts(), []));
  const narrow = useMediaQuery("(max-width: 900px)");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = useRef<HTMLElement>(null);
  const all = [...(work.data?.alerts ?? [])].sort(
    (a, b) => order[a.severity] - order[b.severity],
  );
  const visible = all.filter((a) => filter === "all" || a.severity === filter);
  const current = visible.find((a) => a.key === selected) ?? visible[0];
  const stale = work.loading || !!work.error;
  const timestamp = work.data
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(work.data.generated_at))
    : null;

  function inspect(alert: AdminAlert) {
    setSelected(alert.key);
    // Explicit selection takes keyboard and narrow-screen users directly to the review.
    requestAnimationFrame(() => review.current?.focus());
  }
  async function acknowledge(alert: AdminAlert) {
    if (stale) return;
    await work.act(async () => {
      await adminApi.acknowledgeAlert(
        alert.key,
        notes[alert.key]?.trim() || undefined,
      );
      setNotes((existing) => {
        const next = { ...existing };
        delete next[alert.key];
        return next;
      });
    }, "Acknowledgement recorded for this fingerprint. The underlying condition has not been resolved.");
  }

  const detail = current && (
    <aside
      ref={review}
      id="condition-review"
      tabIndex={-1}
      className={s.review}
      aria-label={`Review ${current.title}`}
    >
      <header>
        <p className={s.eyebrow}>Selected condition</p>
        <h2>Review this condition</h2>
        <span className={s.severity} data-severity={current.severity}>
          {label[current.severity]}
        </span>
      </header>
      <div className={s.reviewSection}>
        <h3>01 / Investigate</h3>
        <p>{current.detail}</p>
        {current.target ? (
          <Link className={s.link} href={current.target}>
            {destination[current.target]} <span aria-hidden="true">↗</span>
          </Link>
        ) : (
          <p className={s.help}>
            No supported configuration destination was supplied. Ask a campus
            administrator where to investigate.
          </p>
        )}
      </div>
      <div className={s.reviewSection}>
        <h3>02 / Record your review</h3>
        <p>
          Mute only this reported fingerprint. Acknowledgement does not fix the
          issue or record a resolution.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void acknowledge(current);
          }}
        >
          <label htmlFor="acknowledgement-note">
            Acknowledgement note <span>Optional</span>
          </label>
          <Textarea
            id="acknowledgement-note"
            rows={3}
            maxLength={300}
            disabled={work.busy}
            aria-label={`Acknowledgement note for ${current.title}`}
            aria-describedby="note-help"
            placeholder="What did you check? What happens next?"
            value={notes[current.key] ?? ""}
            onChange={(e) =>
              setNotes((existing) => ({
                ...existing,
                [current.key]: e.target.value,
              }))
            }
          />
          <p id="note-help" className={s.noteHelp}>
            Stored with your acknowledgement.
            <span>{(notes[current.key] ?? "").length}/300</span>
          </p>
          <Button
            type="submit"
            loading={work.busy}
            disabled={stale}
            className={s.mute}
          >
            Mute this condition
          </Button>
        </form>
        <p className={s.help}>
          A changed fingerprint may return on re-check. An identical fingerprint
          can remain muted. Notes stay in this page until submitted; they are
          not saved drafts.
        </p>
      </div>
      <details className={s.fingerprint}>
        <summary>Reported fingerprint</summary>
        <code>{current.key}</code>
      </details>
    </aside>
  );

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Campus administration / Monitoring</p>
          <h1>Operational alerts</h1>
          <p>A focused view of the conditions that need a closer look.</p>
        </div>
        <Button
          variant="secondary"
          disabled={work.busy || work.loading}
          onClick={work.refresh}
        >
          Re-check
        </Button>
      </header>

      <section className={s.overview} aria-label="Snapshot overview">
        <div className={s.intro}>
          <span className={s.signal} aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M16 3 28 8v8c0 6-6 10-12 13C10 26 4 22 4 16V8L16 3Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M16 10v7m0 4v1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div>
            <p className={s.eyebrow}>Notice. Investigate. Follow through.</p>
            <h2>
              Keep the important
              <br className={s.desktopBreak} /> things in view.
            </h2>
            <p>Review a condition before deciding whether to acknowledge it.</p>
          </div>
        </div>
        <dl className={s.metrics}>
          <div data-tone="critical">
            <dt>Critical</dt>
            <dd>{!stale && work.data ? work.data.counts.critical : "—"}</dd>
            <small>Review first</small>
          </div>
          <div data-tone="warning">
            <dt>Warnings</dt>
            <dd>{!stale && work.data ? work.data.counts.warning : "—"}</dd>
            <small>Needs a closer look</small>
          </div>
          <div>
            <dt>Recorded</dt>
            <dd>{!stale && work.data ? work.data.counts.acknowledged : "—"}</dd>
            <small>All-time mutes</small>
          </div>
        </dl>
      </section>
      <div className={s.snapshot}>
        <p>
          <span aria-hidden="true">◷</span>{" "}
          {work.loading ? (
            "Requesting a fresh snapshot…"
          ) : work.error ? (
            "Snapshot unavailable"
          ) : (
            <>
              Checked{" "}
              <time dateTime={work.data?.generated_at}>{timestamp}</time>
            </>
          )}
        </p>
        <p>On request · Not a continuous live feed</p>
      </div>
      <Feedback value={work.feedback} />

      <section className={s.workspace} aria-label="Condition review workspace">
        <div className={s.queueHeading}>
          <div>
            <p className={s.eyebrow}>Attention queue</p>
            <h2>
              Reported conditions{" "}
              <span>{!stale && work.data ? all.length : "—"}</span>
            </h2>
          </div>
          <p>Critical first, then warnings and information.</p>
        </div>
        <div
          className={s.filters}
          role="group"
          aria-label="Filter alerts by severity"
        >
          {(["all", "critical", "warning", "info"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              disabled={work.busy}
              onClick={() => setFilter(value)}
            >
              {label[value]}
              <span>
                {!stale && work.data
                  ? value === "all"
                    ? all.length
                    : all.filter((a) => a.severity === value).length
                  : "—"}
              </span>
            </button>
          ))}
        </div>
        <ReadState
          loading={work.loading}
          error={work.error}
          retry={work.refresh}
        />
        {!stale &&
          work.data &&
          (visible.length === 0 ? (
            <div className={s.empty}>
              <span aria-hidden="true">{all.length ? "↗" : "✓"}</span>
              <h3>
                {filter === "all"
                  ? "No conditions to review"
                  : `No ${filter} conditions`}
              </h3>
              <p>
                {all.length
                  ? "There are reported conditions in another severity. Change the filter to review them."
                  : "The latest snapshot has no unmuted conditions. This is not a campus-wide health guarantee; acknowledged conditions can still need work."}
              </p>
              {all.length > 0 && (
                <Button variant="secondary" onClick={() => setFilter("all")}>
                  Show all conditions
                </Button>
              )}
            </div>
          ) : (
            <div className={s.triage}>
              <div className={s.ledger}>
                {visible.map((alert) => (
                  <Fragment key={alert.key}>
                    <article
                      className={s.condition}
                      data-severity={alert.severity}
                      data-selected={current?.key === alert.key}
                    >
                      <button
                        type="button"
                        disabled={work.busy}
                        onClick={() => inspect(alert)}
                        aria-pressed={current?.key === alert.key}
                        aria-controls="condition-review"
                        aria-label={`Inspect ${alert.title}`}
                      >
                        <span className={s.conditionTop}>
                          <span
                            className={s.severity}
                            data-severity={alert.severity}
                          >
                            {label[alert.severity]}
                          </span>
                          <span className={s.reviewLabel}>
                            {current?.key === alert.key
                              ? "In review"
                              : "Review"}{" "}
                            <span aria-hidden="true">↗</span>
                          </span>
                        </span>
                        <h3>{alert.title}</h3>
                        <p>{alert.detail}</p>
                        <span className={s.source}>
                          {alert.target
                            ? destination[alert.target]
                            : "No linked configuration screen"}
                        </span>
                      </button>
                    </article>
                    {narrow && current?.key === alert.key && detail}
                  </Fragment>
                ))}
              </div>
              {!narrow && detail}
            </div>
          ))}
      </section>
      <footer className={s.footer}>
        <strong>Acknowledged ≠ resolved.</strong>
        <p>
          This view contains unmuted server-reported conditions only.
          Investigate in the linked console and re-check after making changes.
        </p>
      </footer>
    </div>
  );
}
