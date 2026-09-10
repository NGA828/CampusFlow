'use client';

import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useMotionValueEvent } from 'motion/react';
import { useState } from 'react';

const LINKS = [
  { href: '#features', label: 'Platform' },
  { href: '#navigation', label: 'Navigation' },
  { href: '#queues', label: 'Queues' },
  { href: '#mobile', label: 'Mobile app' },
  { href: '#campus', label: 'Campus' },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (value) => setScrolled(value > 24));

  return (
    <motion.header
      initial={reduced ? undefined : { y: -18, opacity: 0 }}
      animate={reduced ? undefined : { y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        scrolled ? 'border-white/10 bg-ink-950/85 backdrop-blur-xl' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <motion.span
            whileHover={reduced ? undefined : { rotate: -8, scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-[15px] font-bold text-white"
          >
            CF
          </motion.span>
          <span className="text-[15px] font-semibold tracking-tight text-white">CampusFlow</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius-control)] px-3 py-2 text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/status" className="hidden rounded-[var(--radius-control)] px-3 py-2 text-[13px] text-white/60 hover:text-white sm:block">
            Status
          </Link>
          <Link href="/login" className="rounded-[var(--radius-control)] px-3.5 py-2 text-[13px] font-medium text-white/85 hover:text-white">
            Sign in
          </Link>
          <Link href="/register" className="rounded-[var(--radius-control)] bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-900 transition-transform hover:-translate-y-0.5">
            Create account
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Toggle sections"
            className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] border border-white/15 text-white/80 lg:hidden"
          >
            <span aria-hidden="true" className="flex flex-col gap-1">
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <motion.nav
          initial={reduced ? undefined : { height: 0, opacity: 0 }}
          animate={reduced ? undefined : { height: 'auto', opacity: 1 }}
          className="overflow-hidden border-t border-white/10 bg-ink-950/95 px-5 lg:hidden"
          aria-label="Sections"
        >
          <ul className="py-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)} className="block py-2.5 text-[14px] text-white/80">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </motion.nav>
      ) : null}
    </motion.header>
  );
}
