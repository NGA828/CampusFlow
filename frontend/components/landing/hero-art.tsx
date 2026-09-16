'use client';

/**
 * Animated product mock for the landing page hero.
 *
 * This is a real rendering of the floor-plan language the app uses (rooms, corridor graph,
 * QR anchor, computed route) drawn as inline SVG — nothing here is a bitmap screenshot, so it
 * stays crisp on every display and animates without video assets.
 */
import { motion, useReducedMotion } from 'motion/react';

const ROOMS = [
  { x: 18, y: 18, w: 106, h: 74, label: 'A-101', sub: 'Lecture', fill: '#dfe4ff' },
  { x: 132, y: 18, w: 106, h: 74, label: 'A-102', sub: 'Lab', fill: '#e2f5f0' },
  { x: 246, y: 18, w: 136, h: 74, label: 'A-103', sub: 'Studio', fill: '#fff1d6' },
  { x: 18, y: 152, w: 136, h: 74, label: 'A-104', sub: 'Seminar', fill: '#eef1f8' },
  { x: 162, y: 152, w: 110, h: 74, label: 'A-105', sub: 'Office', fill: '#fbe4e7' },
  { x: 280, y: 152, w: 102, h: 74, label: 'A-106', sub: 'Study', fill: '#e9faf6' },
];

/** Waypoints the walker travels: entrance → corridor → stairs → destination door. */
const ROUTE = [
  { x: 58, y: 244 },
  { x: 58, y: 118 },
  { x: 286, y: 118 },
  { x: 286, y: 104 },
];

export function RouteMock({ className, showLabels = true }: { className?: string; showLabels?: boolean }) {
  const reduced = useReducedMotion();

  return (
    <svg viewBox="0 0 400 262" role="img" aria-label="Floor plan of building A with a computed walking route to room A-103" className={className}>
      <defs>
        <linearGradient id="plan-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8f9fe" />
          <stop offset="100%" stopColor="#eef1f8" />
        </linearGradient>
        <linearGradient id="route-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5b5ff2" />
          <stop offset="100%" stopColor="#f9a92c" />
        </linearGradient>
      </defs>

      {/* floor slab */}
      <rect x="6" y="6" width="388" height="250" rx="14" fill="url(#plan-floor)" stroke="#d7dbeb" />
      <rect x="12" y="12" width="376" height="238" rx="10" fill="#ffffff" opacity="0.55" />

      {/* corridor band + stairs */}
      <rect x="18" y="100" width="364" height="44" rx="8" fill="#eef1f8" />
      <rect x="230" y="104" width="34" height="36" rx="6" fill="#dfe4ff" stroke="#c3ccff" />
      <text x="247" y="126" textAnchor="middle" className="fill-brand-700 text-[9px] font-semibold">
        stairs
      </text>
      <rect x="272" y="104" width="34" height="36" rx="6" fill="#e2f5f0" stroke="#9ce6d6" />
      <text x="289" y="126" textAnchor="middle" className="fill-mint-700 text-[9px] font-semibold">
        lift
      </text>

      {/* rooms */}
      {ROOMS.map((room) => (
        <g key={room.label}>
          <rect x={room.x} y={room.y} width={room.w} height={room.h} rx="9" fill={room.fill} stroke="#d7dbeb" />
          <text x={room.x + 12} y={room.y + 24} className="fill-ink-800 text-[11px] font-semibold">
            {room.label}
          </text>
          {showLabels ? (
            <text x={room.x + 12} y={room.y + 40} className="fill-ink-500 text-[9px]">
              {room.sub}
            </text>
          ) : null}
        </g>
      ))}

      {/* QR anchor the walker scanned */}
      <g>
        <rect x="44" y="228" width="28" height="28" rx="7" fill="#ffffff" stroke="#8590b0" strokeDasharray="3 2" />
        <path d="M50 234h6v6h-6zM65 234h4v4h-4zM50 246h4v4h-4zM62 244h6v6h-6z" className="fill-ink-700" />
      </g>

      {/* computed route */}
      <polyline
        points={ROUTE.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="#c3ccff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <motion.polyline
        points={ROUTE.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="url(#route-line)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? undefined : { pathLength: 0 }}
        animate={reduced ? undefined : { pathLength: [0, 1, 1] }}
        transition={{ duration: 7, times: [0, 0.75, 1], repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
      />

      {/* destination */}
      <g>
        <circle cx="286" cy="104" r="13" fill="#f9a92c" opacity="0.22" />
        <circle cx="286" cy="104" r="6.5" fill="#e3890c" stroke="#ffffff" strokeWidth="2.5" />
      </g>

      {/* walker */}
      <motion.circle
        r="6"
        fill="#4340e0"
        stroke="#ffffff"
        strokeWidth="2.5"
        initial={reduced ? { cx: ROUTE[3].x, cy: ROUTE[3].y, r: 6 } : { cx: ROUTE[0].x, cy: ROUTE[0].y, r: 6 }}
        animate={reduced ? undefined : { cx: ROUTE.map((point) => point.x), cy: ROUTE.map((point) => point.y) }}
        transition={{ duration: 7, times: [0, 0.35, 0.75, 1], repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
      />
      {!reduced ? (
        <motion.circle
          r="6"
          fill="none"
          stroke="#4340e0"
          strokeWidth="2"
          initial={{ cx: ROUTE[0].x, cy: ROUTE[0].y, opacity: 0.5, scale: 1, r: 6 }}
          animate={{
            cx: ROUTE.map((point) => point.x),
            cy: ROUTE.map((point) => point.y),
            opacity: [0.5, 0.5, 0],
            r: [6, 16, 22],
          }}
          transition={{ duration: 7, times: [0, 0.35, 0.75, 1], repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
        />
      ) : null}

      {/* step label */}
      <g>
        <rect x="18" y="60" width="150" height="26" rx="8" fill="#101527" opacity="0.92" />
        <text x="30" y="77" className="fill-white text-[10px] font-medium">
          Turn right · 42 m remaining
        </text>
      </g>
    </svg>
  );
}

const CHIPS = [
  { title: 'Next class', body: 'Databases · A-103', meta: 'in 12 min', className: 'left-[-6%] top-[16%]', delay: 0.5 },
  { title: 'Your ticket', body: 'SQ-118 · 3 ahead', meta: '≈ 9 min', className: 'right-[-4%] top-[46%]', delay: 0.75 },
  { title: 'Scanned', body: 'QR-A-ENTRANCE', meta: 'position fixed', className: 'bottom-[6%] left-[8%]', delay: 1 },
];

/** Window-framed product mock used in the hero. */
export function HeroWindow({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div className={className}>
      <motion.div
        initial={reduced ? undefined : { opacity: 0, y: 28, rotateX: 6 }}
        animate={reduced ? undefined : { opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-[22px] border border-white/12 bg-ink-900/80 p-2 shadow-[0_40px_120px_-40px_rgba(8,11,23,0.9)] backdrop-blur"
      >
        <div className="flex items-center gap-2 px-2 pt-1 pb-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          </span>
          <span className="ml-2 flex-1 truncate rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/60">campusflow.app/navigate · Building A · floor 1</span>
          <span className="hidden rounded-full bg-mint-500/20 px-2.5 py-1 text-[10.5px] font-semibold text-mint-300 sm:block">live</span>
        </div>
        <div className="overflow-hidden rounded-[16px] bg-white">
          <RouteMock className="h-auto w-full" />
        </div>
      </motion.div>

      {CHIPS.map((chip) => (
        <motion.div
          key={chip.title}
          initial={reduced ? undefined : { opacity: 0, scale: 0.92, y: 10 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1, y: [0, -7, 0] }}
          transition={{
            opacity: { duration: 0.5, delay: chip.delay },
            scale: { duration: 0.5, delay: chip.delay },
            y: { duration: 6, repeat: Infinity, repeatType: 'reverse', delay: chip.delay, ease: 'easeInOut' },
          }}
          className={`pointer-events-none absolute hidden w-[168px] rounded-2xl border border-white/12 bg-ink-900/90 p-3 shadow-[0_18px_50px_-20px_rgba(8,11,23,0.9)] backdrop-blur md:block ${chip.className}`}
        >
          <p className="text-[10.5px] font-semibold tracking-wide text-white/50 uppercase">{chip.title}</p>
          <p className="mt-1 text-[13px] font-semibold text-white">{chip.body}</p>
          <p className="text-[11.5px] text-brand-300">{chip.meta}</p>
        </motion.div>
      ))}
    </div>
  );
}
