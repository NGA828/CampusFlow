'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cx } from './kit';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONES: Record<ToastTone, { ring: string; icon: ReactNode }> = {
  success: {
    ring: 'border-mint-200 bg-mint-50',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-mint-600" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    ring: 'border-coral-200 bg-coral-50',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-coral-600" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  info: {
    ring: 'border-brand-200 bg-brand-50',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 11v5M12 7.5v.5" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  warning: {
    ring: 'border-signal-200 bg-signal-50',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-signal-600" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4M12 16.5v.5M10.3 3.9L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      setTimeout(() => remove(id), toast.tone === 'error' ? 8000 : 5000);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ title, description, tone: 'success' }),
      error: (title, description) => push({ title, description, tone: 'error' }),
      info: (title, description) => push({ title, description, tone: 'info' }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx('animate-rise pointer-events-auto flex w-full max-w-sm gap-3 rounded-[var(--radius-card)] border px-4 py-3 shadow-[var(--shadow-pop)]', TONES[toast.tone].ring)}
          >
            <span className="mt-0.5">{TONES[toast.tone].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink-900">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-600">{toast.description}</p> : null}
            </div>
            <button type="button" onClick={() => remove(toast.id)} aria-label="Dismiss notification" className="text-ink-400 hover:text-ink-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}
