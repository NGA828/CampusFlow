"use client";

import type { Session, User } from "@/lib/api/types";

/**
 * Client-side session storage for the web app.
 *
 * The backend (Laravel Sanctum) is the authority for authentication; this
 * module only persists the issued token + cached user profile and exposes a
 * tiny subscription API so the UI can react to sign-in/sign-out.
 */

const TOKEN_KEY = "campusflow.token";
const USER_KEY = "campusflow.user";

const isBrowser = () => typeof window !== "undefined";

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getCachedUser(): User | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  emit();
}

export function clearSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  emit();
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
