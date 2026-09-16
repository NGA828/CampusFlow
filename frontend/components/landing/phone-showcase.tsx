'use client';

/**
 * Mobile app showcase.
 *
 * The three screens are the same composition language as the shipped Expo app (home, timetable,
 * scanner) rendered with real markup so the strip stays sharp and animates without screenshots.
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';

function PhoneFrame({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={className} role="img" aria-label={label}>
      <div className="relative h-[476px] w-[232px] rounded-[38px] border border-white/15 bg-ink-900 p-[10px] shadow-[0_30px_80px_-30px_rgba(8,11,23,0.95)]">
        <div className="absolute left-1/2 top-[18px] z-20 h-[22px] w-[78px] -translate-x-1/2 rounded-full bg-ink-900" aria-hidden="true" />
        <div className="h-full w-full overflow-hidden rounded-[30px] bg-white">
          <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[10px] font-semibold text-ink-800">
            <span>9:41</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="h-2 w-3 rounded-[2px] bg-ink-300" />
              <span className="h-2 w-2 rounded-full bg-ink-300" />
              <span className="h-2 w-4 rounded-[3px] bg-ink-400" />
            </span>
          </div>
          <div className="h-[440px] overflow-hidden px-4 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function HomeScreen() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10.5px] font-medium tracking-wide text-ink-400 uppercase">Tuesday</p>
        <h4 className="text-[16px] font-semibold text-ink-900">Hi Amina</h4>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-3.5 text-white">
        <p className="text-[10px] font-semibold tracking-wide uppercase opacity-80">Next class · in 12 min</p>
        <p className="mt-1 text-[14px] font-semibold">Databases & SQL</p>
        <p className="text-[11.5px] opacity-85">A-103 · Studio · Dr. Osei</p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10.5px] font-medium">Navigate</span>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10.5px] font-medium">Syllabus</span>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-100 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-ink-700">Room queue</p>
          <span className="rounded-full bg-mint-50 px-2 py-0.5 text-[10px] font-semibold text-mint-700">serving 117</span>
        </div>
        <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink-900 tabular-nums">SQ-118</p>
        <p className="text-[11px] text-ink-500">3 people ahead · ≈ 9 min · check in before 10:04</p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-signal-50 p-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-signal-400/25 text-[11px] font-bold text-signal-700">!</span>
        <p className="text-[11px] leading-snug text-signal-700">Library closes at 18:00 today for maintenance.</p>
      </div>
    </div>
  );
}

function TimetableScreen() {
  const sessions = [
    { time: '09:00', code: 'CSC201', title: 'Data Structures', room: 'B · B-204', tone: 'bg-brand-100 text-brand-700' },
    { time: '11:00', code: 'CSC215', title: 'Databases & SQL', room: 'A · A-103', tone: 'bg-mint-100 text-mint-700' },
    { time: '14:00', code: 'MAT140', title: 'Linear Algebra', room: 'C · C-012', tone: 'bg-signal-100 text-signal-700' },
  ];
  return (
    <div className="space-y-3">
      <h4 className="text-[15px] font-semibold text-ink-900">Tuesday</h4>
      <div className="flex gap-1.5" aria-hidden="true">
        {['M', 'T', 'W', 'T', 'F'].map((day, index) => (
          <span
            key={`${day}-${index}`}
            className={`grid h-7 w-7 place-items-center rounded-full text-[10.5px] font-semibold ${
              index === 1 ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500'
            }`}
          >
            {day}
          </span>
        ))}
      </div>
      <ul className="space-y-2">
        {sessions.map((session) => (
          <li key={session.code} className="rounded-2xl border border-ink-100 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-500 tabular-nums">{session.time}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${session.tone}`}>{session.code}</span>
            </div>
            <p className="mt-1 text-[13px] font-semibold text-ink-900">{session.title}</p>
            <p className="text-[11px] text-ink-500">{session.room}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScanScreen() {
  return (
    <div className="space-y-3">
      <h4 className="text-[15px] font-semibold text-ink-900">Scan an anchor</h4>
      <div className="relative h-[250px] overflow-hidden rounded-2xl bg-ink-900">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_30%_20%,#5b5ff2_0%,transparent_45%),radial-gradient(circle_at_70%_70%,#2fb8a0_0%,transparent_45%)]" />
        <div className="absolute inset-6 rounded-xl border-2 border-white/70" />
        <div className="absolute left-6 top-6 h-6 w-6 border-t-[3px] border-l-[3px] border-signal-400" />
        <div className="absolute right-6 top-6 h-6 w-6 border-t-[3px] border-r-[3px] border-signal-400" />
        <div className="absolute bottom-6 left-6 h-6 w-6 border-b-[3px] border-l-[3px] border-signal-400" />
        <div className="absolute bottom-6 right-6 h-6 w-6 border-b-[3px] border-r-[3px] border-signal-400" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 to-transparent px-3 pt-8 pb-3">
          <p className="text-[11px] font-semibold text-white">Point at the QR code by the door</p>
          <p className="text-[10.5px] text-white/60">Signatures are verified by the CampusFlow API.</p>
        </div>
      </div>
      <div className="rounded-2xl border border-mint-200 bg-mint-50 p-3">
        <p className="text-[11.5px] font-semibold text-mint-700">Anchor recognised</p>
        <p className="text-[11px] text-mint-700/80">Building A · level 1 · 12 m from A-103</p>
      </div>
    </div>
  );
}

const SCREENS = [
  { key: 'home', label: 'CampusFlow mobile home screen', node: <HomeScreen /> },
  { key: 'timetable', label: 'CampusFlow mobile timetable screen', node: <TimetableScreen /> },
  { key: 'scan', label: 'CampusFlow mobile QR scanner screen', node: <ScanScreen /> },
] as const;

export function PhoneShowcase({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % SCREENS.length), 4200);
    return () => clearInterval(timer);
  }, [reduced]);

  const active = SCREENS[index];

  return (
    <div className={`@container relative ${className ?? ''}`}>
      <div className="flex items-end justify-center gap-5">
        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 26, rotate: -6 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0, rotate: -6 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="hidden origin-bottom scale-[0.86] @min-[720px]:block"
        >
          <PhoneFrame label="Timetable screen">
            <TimetableScreen />
          </PhoneFrame>
        </motion.div>

        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 34, scale: 0.96 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
        >
          <PhoneFrame label={active.label}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.key}
                initial={reduced ? undefined : { opacity: 0, x: 18 }}
                animate={reduced ? undefined : { opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -18 }}
                transition={{ duration: 0.38, ease: 'easeOut' }}
              >
                {active.node}
              </motion.div>
            </AnimatePresence>
          </PhoneFrame>

          <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden="true">
            {SCREENS.map((screen, dotIndex) => (
              <span
                key={screen.key}
                className={`h-1.5 rounded-full transition-all ${dotIndex === index ? 'w-5 bg-brand-400' : 'w-1.5 bg-white/25'}`}
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 26, rotate: 6 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0, rotate: 6 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="hidden origin-bottom scale-[0.86] @min-[720px]:block"
        >
          <PhoneFrame label="QR scanner screen">
            <ScanScreen />
          </PhoneFrame>
        </motion.div>
      </div>
    </div>
  );
}

export function MobileScreenList({ className }: { className?: string }) {
  const items = [
    { title: 'Scan to get located', body: 'The camera reads the QR anchor by the door; the API verifies the signature and fixes your indoor position.' },
    { title: 'Live queue tickets', body: 'Join, check in and get called — the ticket updates over the websocket while the app is in the background.' },
    { title: 'Push + in-app reminders', body: 'Class reminders, approaching-turn alerts and announcements arrive as notifications.' },
    { title: 'Works on both platforms', body: 'One Expo codebase runs the Android and iOS builds against the same REST API as the web app.' },
  ];
  return (
    <ul className={`space-y-4 ${className ?? ''}`}>
      {items.map((item) => (
        <li key={item.title} className="flex gap-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/15 text-[11px] font-bold text-brand-300" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="text-[14.5px] font-semibold text-white">{item.title}</p>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-white/65">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
