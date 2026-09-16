'use client';

/**
 * Motion primitives for the public landing page.
 *
 * Everything here respects `prefers-reduced-motion`: when a visitor asks for reduced motion the
 * animations collapse to a static, instantly-visible state (never hidden content).
 */
import { motion, useReducedMotion, useScroll, useSpring, type Variants } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-brand-400 via-brand-500 to-signal-400"
    />
  );
}

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

export function Reveal({
  children,
  delay = 0,
  className,
  once = true,
  eager = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
  eager?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={revealVariants}
      initial="hidden"
      animate={eager ? 'show' : undefined}
      whileInView={eager ? undefined : 'show'}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  delayChildren = 0.05,
  step = 0.07,
  eager = false,
}: {
  children: ReactNode;
  className?: string;
  delayChildren?: number;
  step?: number;
  eager?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate={eager ? 'show' : undefined}
      whileInView={eager ? undefined : 'show'}
      viewport={{ once: true, amount: 0.15 }}
      variants={{ show: { transition: { staggerChildren: step, delayChildren } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, y = 24 }: { children: ReactNode; className?: string; y?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up once the value scrolls into view. Values come from the API, never invented. */
export function Counter({ value, className, duration = 1100 }: { value: number; className?: string; duration?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  // The server renders the real figure so the page is readable without JavaScript; the
  // count-up only takes over on the client, immediately after hydration.
  const [display, setDisplay] = useState(value);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const node = ref.current;
    if (!node) return;
    setDisplay(0);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!started || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, reduced, value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
    </span>
  );
}

/** Soft parallax wrapper used for the photographic panels. */
export function Parallax({ children, className, distance = 40 }: { children: ReactNode; className?: string; distance?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
        setOffset(Math.max(-1, Math.min(1, progress)) * distance);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced, distance]);

  return (
    <div ref={ref} className={className}>
      <div style={reduced ? undefined : { transform: `translate3d(0, ${offset}px, 0)` }} className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
