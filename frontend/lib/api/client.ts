import type { ApiEnvelope } from "./types";
import { API_URL, isMockMode } from "./config";
import { mockRequest } from "./mock";
import { getToken } from "@/lib/auth/session";

/**
 * Centralized API client.
 *
 * Every network call in the CampusFlow web app flows through here so that
 * authentication, error normalization, timeouts and the base URL are handled
 * in exactly one place — never scattered `fetch()` calls in components.
 *
 * Base URL comes from environment configuration (never hardcoded):
 *   NEXT_PUBLIC_API_URL   e.g. http://localhost:8000/api
 *   NEXT_PUBLIC_API_MODE  "live" | "mock" (defaults to "mock" when no API URL
 *                         is configured — used for local UI development only)
 */

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function liveRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "No API configured. Set NEXT_PUBLIC_API_URL to point at the CampusFlow backend.",
      0,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const signal = options.signal ?? controller.signal;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<T>
      | null;

    if (!response.ok) {
      const message =
        payload?.message ??
        (response.status >= 500
          ? "Something went wrong on our side. Please try again."
          : "The request could not be completed.");
      throw new ApiError(message, response.status, payload?.errors);
    }

    if (payload && payload.success === false) {
      throw new ApiError(
        payload.message ?? "Request failed",
        response.status,
        payload.errors,
      );
    }

    return (payload?.data ?? payload) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "The request timed out. Check your connection and try again.",
        408,
      );
    }
    throw new ApiError(
      "You're offline or the server is unreachable. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (isMockMode) {
    return mockRequest<T>(path, options);
  }
  return liveRequest<T>(path, options);
}
