import Link from "next/link";
import { Logo, LogoMark } from "@/components/layout/brand";
import {
  IconArrowRight,
  IconBell,
  IconCompass,
  IconQueue,
  IconSparkle,
} from "@/components/ui/icons";

const FEATURES = [
  {
    icon: <IconCompass className="h-5 w-5" />,
    title: "Indoor navigation",
    body: "Scan a QR node, get your known position, and follow a computed route to any room — with off-route detection and recalculations.",
  },
  {
    icon: <IconQueue className="h-5 w-5" />,
    title: "Fair queues, no crowding",
    body: "Join room admission queues and administrative-office ticket queues. Positions are assigned safely by the backend — never by the client.",
  },
  {
    icon: <IconBell className="h-5 w-5" />,
    title: "Real-time updates",
    body: "Your ticket position, calls, check-in windows and announcements arrive over live channels — no manual refresh.",
  },
  {
    icon: <IconSparkle className="h-5 w-5" />,
    title: "AI campus assistant",
    body: "Ask in plain language — \u201cWhere is my next class?\u201d — and get answers powered by controlled backend tools, not guesswork.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
          >
            Get started
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pt-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              One connected campus experience
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Navigate. Learn.
              <br />
              <span className="bg-gradient-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">
                Connect.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-ink-600">
              CampusFlow turns a fragmented day of paper schedules, physical
              queues and \u201cwhere is my class?\u201d into one intelligent
              platform for students, staff and administrators.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
              >
                Open the student app
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center rounded-lg border border-ink-200 px-6 text-sm font-semibold text-ink-800 transition-colors hover:bg-ink-50"
              >
                See what it does
              </a>
            </div>
          </div>

          <div className="relative animate-fade-in" aria-hidden="true">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-brand-100 via-accent-50 to-ink-100 blur-2xl" />
            <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-lifted">
              {/* Next-class card mock */}
              <div className="rounded-xl bg-ink-900 p-5 text-white">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-300">
                  Next class
                </p>
                <p className="mt-2 text-lg font-semibold">Database Systems</p>
                <div className="mt-3 flex items-center gap-5 text-sm text-ink-200">
                  <span>10:00 AM</span>
                  <span className="text-ink-400">•</span>
                  <span>Room B204</span>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-white/10 px-4 py-3">
                  <span className="text-sm">Engineering Building · Floor 2</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold">
                    Navigate
                  </span>
                </div>
              </div>
              {/* Ticket row */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-ink-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    Principal&apos;s Office
                  </p>
                  <p className="text-xs text-ink-500">Ticket P-024 · #3 in queue</p>
                </div>
                <span className="rounded-full bg-warning-50 px-3 py-1 text-xs font-semibold text-warning-700 ring-1 ring-inset ring-amber-200">
                  12 min wait
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-ink-100 bg-ink-50 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-ink-900">
                One app for the whole campus day
              </h2>
              <p className="mt-3 text-ink-600">
                Timetables, wayfinding, room search, queues and office visits —
                connected, real-time and secure.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-ink-200 bg-white p-6 shadow-card transition-shadow hover:shadow-lifted"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    {f.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-ink-900">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold text-ink-900">CampusFlow</span>
          </span>
          <p className="text-xs text-ink-500">
            Navigate. Learn. Connect. © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
