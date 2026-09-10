/**
 * API runtime configuration (safe to import from server or client).
 * Values come from environment configuration — never hardcoded.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export const API_MODE =
  process.env.NEXT_PUBLIC_API_MODE ?? (API_URL.length > 0 ? "live" : "mock");

export const isMockMode = API_MODE === "mock";
