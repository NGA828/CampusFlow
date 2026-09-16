import Image from 'next/image';
import Link from 'next/link';
import { publicApi } from '@/lib/api/endpoints';
import { SiteHeader } from '@/components/landing/site-header';
import { HeroWindow, RouteMock } from '@/components/landing/hero-art';
import { MobileScreenList, PhoneShowcase } from '@/components/landing/phone-showcase';
import { Counter, Parallax, Reveal, ScrollProgress, Stagger, StaggerItem } from '@/components/landing/motion-primitives';

export const revalidate = 60;

const FEATURES = [
  {
    title: 'Personal timetable',
    body: 'Your week is derived from the courses you are enrolled in — including room changes, session type and the next class countdown.',
    accent: 'bg-brand-50 text-brand-700',
    icon: (
      <path d="M8 4v3M16 4v3M4 10h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z" strokeLinecap="round" />
    ),
  },
  {
    title: 'Indoor wayfinding',
    body: 'Scan a QR anchor in a corridor, then follow turn-by-turn indoor routes with accessible options and automatic re-routing when you drift off course.',
    accent: 'bg-signal-50 text-signal-700',
    icon: <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" strokeLinecap="round" />,
  },
  {
    title: 'Room admission queues',
    body: 'Join a controlled room queue from anywhere, see your position, people ahead and a live wait estimate, then check in when you are actually there.',
    accent: 'bg-mint-50 text-mint-700',
    icon: <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />,
  },
  {
    title: 'Administrative offices',
    body: "Tickets for the Principal's Office, Secretary, Student Affairs, Dean and Registrar — with ticket numbers, service windows and proximity check-in.",
    accent: 'bg-coral-50 text-coral-600',
    icon: <path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5" strokeLinecap="round" />,
  },
  {
    title: 'Real-time everything',
    body: 'Queue positions, ticket calls and announcements update live over a websocket — no refresh, no polling.',
    accent: 'bg-brand-50 text-brand-700',
    icon: <path d="M12 12h.01M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7" strokeLinecap="round" />,
  },
  {
    title: 'AI Campus Assistant',
    body: 'Ask for a room, a route or the shortest office queue in plain language. Every answer comes from a controlled backend tool, never from guesswork.',
    accent: 'bg-signal-50 text-signal-700',
    icon: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" strokeLinecap="round" />,
  },
];

const STEPS = [
  { title: 'Sign in with your campus account', body: 'Role-aware from the first request — students, staff and administrators each get their own workspace.' },
  { title: 'Find the room, then walk it', body: 'Search by code or course, preview the availability, and let the route guide you indoors and out.' },
  { title: 'Queue without standing in line', body: 'Take a ticket for a room or an office, watch your position live, and get called when it is your turn.' },
];

export default async function LandingPage() {
  const overview = await publicApi.overview().catch(() => null);

  const stats = [
    { label: 'Buildings mapped', value: overview?.stats.buildings ?? 0 },
    { label: 'Bookable rooms', value: overview?.stats.rooms ?? 0 },
    { label: 'Service offices', value: overview?.stats.offices ?? 0 },
    { label: 'Seats tracked', value: overview?.stats.seats ?? 0 },
  ];

  return (
    <div className="landing-page min-h-dvh bg-ink-950 text-white">
      <ScrollProgress />
      <SiteHeader />

      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/campus-aerial.jpg"
            alt="Aerial view of the university campus at golden hour"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-950/80 via-ink-950/88 to-ink-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(91,95,242,0.35),transparent_55%)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-12 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-28">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/75 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
                </span>
                Navigate. Learn. Connect.
              </p>
            </Reveal>

            <Stagger className="mt-6" step={0.1}>
              <StaggerItem>
                <h1 className="max-w-2xl text-4xl leading-[1.06] font-semibold tracking-tight sm:text-6xl">
                  Find your room.
                  <br />
                  Beat the queue.
                  <br />
                  <span className="bg-gradient-to-r from-signal-300 via-signal-400 to-coral-400 bg-clip-text text-transparent">Ask anything on campus.</span>
                </h1>
              </StaggerItem>
              <StaggerItem>
                <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-white/70">
                  CampusFlow connects your timetable, the buildings around you and the services you need — one platform for students, staff and administrators, with an API that keeps
                  every screen honest.
                </p>
              </StaggerItem>
              <StaggerItem className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="rounded-[var(--radius-control)] bg-brand-600 px-5 py-3 text-[14px] font-semibold shadow-[0_18px_40px_-18px_rgba(91,95,242,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-brand-500"
                >
                  Get started — it&apos;s free for students
                </Link>
                <a
                  href="#mobile"
                  className="rounded-[var(--radius-control)] border border-white/20 px-5 py-3 text-[14px] font-semibold text-white/90 transition-colors hover:bg-white/5"
                >
                  See the mobile app
                </a>
              </StaggerItem>
            </Stagger>

            <Reveal delay={0.25} className="mt-12">
              {overview ? (
                <dl className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 backdrop-blur">
                      <dt className="text-[11.5px] text-white/60">{stat.label}</dt>
                      <dd className="mt-1 text-2xl font-semibold tabular-nums">
                        <Counter value={stat.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-white/60">
                  Live campus figures appear here once the CampusFlow API is running.
                </p>
              )}
            </Reveal>
          </div>

          <div className="relative">
            <HeroWindow className="relative" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 3 steps */}
      <section className="border-t border-white/10 bg-ink-900/60">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <Stagger className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <StaggerItem key={step.title} className="relative">
                <div className="flex items-start gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-600/15 text-[15px] font-semibold text-brand-300">{index + 1}</span>
                  <div>
                    <h3 className="text-[15px] font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">{step.body}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 ? (
                  <span aria-hidden="true" className="absolute right-[-12px] top-5 hidden h-px w-6 bg-gradient-to-r from-white/20 to-transparent md:block" />
                ) : null}
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ----------------------------------------------------------- features */}
      <section id="features" className="scroll-mt-20 border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One campus, one platform</h2>
            <p className="mt-2 max-w-2xl text-[15px] text-white/65">
              The web app, the mobile app and the API share the same contracts, so a ticket created on your phone is instantly visible on staff dashboards.
            </p>
          </Reveal>

          <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <StaggerItem key={feature.title}>
                <article className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06] hover:shadow-[0_24px_60px_-30px_rgba(91,95,242,0.8)]">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${feature.accent} transition-transform duration-300 group-hover:scale-110`}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      {feature.icon}
                    </svg>
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">{feature.body}</p>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* --------------------------------------------------------- navigation */}
      <section id="navigation" className="scroll-mt-20 border-t border-white/10 bg-ink-900/60">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2">
          <Reveal>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_30px_80px_-40px_rgba(8,11,23,0.9)]">
              <div className="overflow-hidden rounded-2xl bg-white">
                <RouteMock className="h-auto w-full" />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-[12px] font-semibold tracking-wide text-brand-300 uppercase">Indoor + outdoor navigation</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">It knows which corridor you are standing in</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">
              QR anchors, floor plans and a real walking graph live in the database — not in a hand-waved string coordinate. The API computes the route with A*, prefers step-free
              paths when you ask for them, and re-plans the moment you wander off course.
            </p>
            <ul className="mt-6 space-y-3 text-[14px] text-white/75">
              {[
                'Scan a signed QR anchor to fix your indoor position.',
                'Turn-by-turn steps grouped per floor, with distance and stairs warnings.',
                'Off-route detection warns you first, waits out a grace period, then recalculates.',
                'Live position updates over the websocket while you walk.',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/student/campus/map" className="mt-7 inline-flex items-center gap-2 text-[14px] font-semibold text-brand-300 hover:text-brand-200">
              Open the campus map
              <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- queues */}
      <section id="queues" className="scroll-mt-20 border-t border-white/10">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <p className="text-[12px] font-semibold tracking-wide text-mint-300 uppercase">Queues & service offices</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Take a ticket, then go and sit down</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">
              Room admission and administrative offices both issue real tickets through a transactional backend: no duplicate active tickets, no line jumping, no ghosting — proximity
              check-in keeps the queue honest.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">Room queue</p>
                <p className="mt-1.5 text-[28px] font-semibold tabular-nums">SQ-118</p>
                <p className="mt-1 text-[13px] text-white/70">3 people ahead · ≈ 9 min</p>
                <p className="mt-3 inline-flex rounded-full bg-mint-500/15 px-2.5 py-1 text-[11.5px] font-semibold text-mint-300">Check in before 10:04</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">Student Affairs</p>
                <p className="mt-1.5 text-[28px] font-semibold tabular-nums">SA-903</p>
                <p className="mt-1 text-[13px] text-white/70">Expected 11:15 – 11:30</p>
                <p className="mt-3 inline-flex rounded-full bg-signal-400/15 px-2.5 py-1 text-[11.5px] font-semibold text-signal-300">You are next in line</p>
              </div>
            </div>

            <ul className="mt-6 space-y-3 text-[14px] text-white/75">
              {[
                'Configurable capacity, grace periods, check-in windows and no-show policy.',
                'Position, people ahead and expected service window, recomputed as the line moves.',
                'Staff consoles call, admit, complete or mark a no-show with a full audit trail.',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="order-1 lg:order-2">
            <div className="relative h-[380px] overflow-hidden rounded-3xl border border-white/10">
              <Parallax className="h-full" distance={34}>
                <div className="relative h-[115%] w-full">
                  <Image src="/images/office-service.jpg" alt="Students waiting at a university administrative service desk" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
                </div>
              </Parallax>
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-ink-950/70 p-4 backdrop-blur">
                <p className="text-[12px] text-white/60">Registrar&apos;s Office · ticket R-024</p>
                <p className="mt-1 text-[14px] font-semibold">“Your turn in 2 minutes — please come to counter 3.”</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- mobile */}
      <section id="mobile" className="scroll-mt-20 border-t border-white/10 bg-ink-900/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <p className="text-[12px] font-semibold tracking-wide text-signal-300 uppercase">Mobile app · Expo · iOS &amp; Android</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">The same campus, in your pocket</h2>
            <p className="mt-2 max-w-2xl text-[15px] text-white/65">
              The mobile app is a first-class client: it talks to the same REST API with the same role rules, holds its token in the device keychain, and keeps working while the app is in
              the background.
            </p>
          </Reveal>

          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <PhoneShowcase />

            <div>
              <MobileScreenList />
              <div className="mt-7 rounded-2xl border border-white/10 bg-ink-950/70 p-4">
                <p className="text-[12px] font-semibold tracking-wide text-white/50 uppercase">Run it locally</p>
                <pre className="mt-2 overflow-x-auto text-[12.5px] leading-relaxed text-white/75">
                  <code>{`cd mobile && npm install
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8000/api/v1 npm run start
# then scan the QR code with the Expo Go app`}</code>
                </pre>
              </div>
            </div>
          </div>

          <Reveal delay={0.1} className="mt-14">
            <div className="grid overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] lg:grid-cols-[1.2fr_1fr]">
              <div className="relative min-h-[260px]">
                <Image src="/images/student-phone.jpg" alt="Student checking CampusFlow on their phone in a campus corridor" fill sizes="(min-width: 1024px) 640px, 100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink-950/70" />
              </div>
              <div className="p-7">
                <h3 className="text-[18px] font-semibold">Notifications that arrive at the right moment</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">
                  Class reminders, approaching-turn alerts, ticket calls and campus announcements are delivered as in-app notifications, push messages and live websocket events — all from
                  the same notification service, so nothing is sent that the API did not record.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-[12px] text-white/60">
                  {['Class reminders', 'Your turn', 'Approaching office', 'Building alerts', 'Announcements'].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- campus */}
      <section id="campus" className="scroll-mt-20 border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inside the buildings</h2>
                <p className="mt-2 max-w-2xl text-[15px] text-white/65">
                  Lecture theatres, labs, service desks and study rooms are modelled with floors, capacities, amenities and accessibility features — availability is computed from the
                  timetable, never stored as a flag.
                </p>
              </div>
              <Link href="/student/campus/rooms" className="text-[13.5px] font-semibold text-brand-300 hover:text-brand-200">
                Browse rooms →
              </Link>
            </div>
          </Reveal>

          <Stagger className="mt-10 grid gap-4 sm:grid-cols-3" step={0.09}>
            {[
              { src: '/images/lecture-hall.jpg', alt: 'University lecture theatre with students seated', title: 'Lecture theatres & labs', body: 'Capacity, session types and live occupancy.' },
              { src: '/images/office-service.jpg', alt: 'University service office with a reception counter', title: 'Service desks', body: 'Windows, daily capacity and expected waits.' },
              { src: '/images/student-phone.jpg', alt: 'Student using the CampusFlow app on a phone', title: 'Study space', body: 'Free now, busy soon — before you walk over.' },
            ].map((card) => (
              <StaggerItem key={card.title}>
                <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 hover:border-white/25">
                  <div className="relative h-44 overflow-hidden">
                    <Image
                      src={card.src}
                      alt={card.alt}
                      fill
                      sizes="(min-width: 640px) 340px, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-[15px] font-semibold">{card.title}</h3>
                    <p className="mt-1.5 text-[13.5px] text-white/65">{card.body}</p>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ----------------------------------------------------------- notices */}
      {overview?.announcements?.length ? (
        <section className="border-t border-white/10 bg-ink-900/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight">Campus notices</h2>
              <p className="mt-2 text-[14.5px] text-white/60">Published by staff through the same announcements screen students read in the app.</p>
            </Reveal>
            <Stagger className="mt-6 grid gap-3 sm:grid-cols-2">
              {overview.announcements.slice(0, 4).map((announcement) => (
                <StaggerItem key={announcement.id}>
                  <article className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20">
                    <h3 className="text-[14.5px] font-semibold">{announcement.title}</h3>
                    <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-white/65">{announcement.body}</p>
                  </article>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      ) : null}

      {overview?.events?.length ? (
        <section className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">What&apos;s happening</h2>
                <Link href="/student/campus/events" className="text-[13.5px] font-semibold text-brand-300 hover:text-brand-200">
                  All events →
                </Link>
              </div>
            </Reveal>
            <Stagger className="mt-6 grid gap-3 sm:grid-cols-3">
              {overview.events.slice(0, 3).map((event) => (
                <StaggerItem key={event.id}>
                  <article className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/20">
                    <p className="text-[11.5px] font-semibold tracking-wide text-signal-400 uppercase">{event.category}</p>
                    <h3 className="mt-2 text-[14.5px] font-semibold">{event.title}</h3>
                    <p className="mt-1.5 text-[13px] text-white/60">
                      {new Date(event.starts_at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {event.venue ? ` · ${event.venue}` : ''}
                    </p>
                  </article>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- CTA */}
      <section className="relative overflow-hidden border-t border-white/10">
        <div className="absolute inset-0">
          <Image src="/images/campus-aerial.jpg" alt="" aria-hidden="true" fill sizes="100vw" className="object-cover object-bottom opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-ink-950/85 to-ink-950" />
        </div>
        <Reveal className="relative mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your next class is already waiting</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
            Create a student account, or sign in as staff or an administrator to run the queues, publish the timetable and keep the campus map current.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-[var(--radius-control)] bg-brand-600 px-6 py-3 text-[14px] font-semibold transition-transform hover:-translate-y-0.5 hover:bg-brand-500"
            >
              Create your account
            </Link>
            <Link href="/login" className="rounded-[var(--radius-control)] border border-white/20 px-6 py-3 text-[14px] font-semibold text-white/90 hover:bg-white/5">
              Sign in
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[12.5px] text-white/50">
          <p>© {new Date().getFullYear()} CampusFlow · Northfield University demo deployment</p>
          <p className="flex items-center gap-4">
            <Link href="/status" className="hover:text-white/80">
              Service status
            </Link>
            <a href="#mobile" className="hover:text-white/80">
              Mobile app
            </a>
            <Link href="/login" className="hover:text-white/80">
              Sign in
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
