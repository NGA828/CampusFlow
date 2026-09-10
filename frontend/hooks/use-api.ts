"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";

/**
 * Minimal data-fetching hook with a consistent loading/error/empty lifecycle.
 * Keeps API concerns (duplicate requests, stale responses, aborts) out of
 * feature components.
 *
 * The effect only re-runs when `deps` (or the manual refetch nonce) change,
 * so an inline `fetcher` closure is safe to pass without retriggering.
 */

interface ApiResourceState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  refetch: () => void;
}

export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[] = [],
): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof ApiError ? err : new ApiError("Unexpected error", 0));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, loading, refetch };
}
