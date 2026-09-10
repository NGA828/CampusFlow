"use client";

import { useEffect, useState } from "react";
import {
  clearSession,
  getCachedUser,
  isAuthenticated,
  subscribe,
} from "@/lib/auth/session";
import type { User } from "@/lib/api/types";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getCachedUser());
    setAuthed(isAuthenticated());
    setReady(true);

    return subscribe(() => {
      setUser(getCachedUser());
      setAuthed(isAuthenticated());
    });
  }, []);

  return { user, authed, ready, signOut: clearSession };
}
