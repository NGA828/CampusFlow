"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/components/layout/student-companion";
/** One mutation at a time, authoritative refresh before unlock, latest read wins. */
export function useOperator<T>(reader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const sequence = useRef(0);
  const lock = useRef(false);
  const load = useCallback(async () => {
    const version = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const result = await reader();
      if (version === sequence.current) setData(result);
    } catch (e) {
      if (version === sequence.current) {
        setData(null);
        setError(errorMessage(e, "Could not refresh this workspace."));
      }
    } finally {
      if (version === sequence.current) setLoading(false);
    }
  }, [reader]);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      invalidate();
    };
  }, [load, invalidate]);
  const refresh = useCallback(() => {
    if (!lock.current) void load();
  }, [load]);
  const act = async (action: () => Promise<void>, message: string) => {
    if (lock.current) return;
    lock.current = true;
    sequence.current++;
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      setFeedback({ error: false, text: message });
    } catch (e) {
      setFeedback({
        error: true,
        text: errorMessage(
          e,
          "The action could not be confirmed. Refresh before trying again.",
        ),
      });
    } finally {
      await load();
      lock.current = false;
      setBusy(false);
    }
  };
  return { data, loading, error, busy, feedback, refresh, act };
}
