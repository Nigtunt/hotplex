/**
 * Webchat configuration — single source of truth.
 *
 * All HOTPLEX_WEBCHAT_* env vars are defined here.
 * To add a new config:
 *   1. Add the env var to `.env.example` / `.env.local`
 *   2. Add the field here with a sensible default
 *   3. `next.config.mjs` auto-forwards all HOTPLEX_WEBCHAT_* vars to the client
 *
 * Runtime overrides: apiKey and wsUrl can be changed at runtime via
 * setApiKey() / setWsUrl(). Values are persisted to localStorage and
 * take precedence over build-time env vars.
 */

import type { WorkerType } from "@/lib/ai-sdk-transport/client/constants";

// -- localStorage keys -------------------------------------------------

const STORAGE_KEY_API_KEY = "hotplex_chat_api_key";
const STORAGE_KEY_WS_URL = "hotplex_chat_ws_url";

// -- Gateway -----------------------------------------------------------

function resolveWsUrl(): string {
  const envUrl = process.env.HOTPLEX_WEBCHAT_WS_URL;
  if (envUrl) return envUrl;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  }
  return "ws://localhost:8888/ws";
}

function readStorage(key: string): string | null {
  try {
    if (typeof window !== "undefined") return window.localStorage.getItem(key);
  } catch { /* ignore */ }
  return null;
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

// -- Runtime getters (localStorage → env var → default) ---------------

export function getApiKey(): string {
  const stored = readStorage(STORAGE_KEY_API_KEY);
  if (stored) return stored;
  return process.env.HOTPLEX_WEBCHAT_API_KEY ?? "dev";
}

export function setApiKey(key: string): void {
  writeStorage(STORAGE_KEY_API_KEY, key);
}

export function getWsUrl(): string {
  const stored = readStorage(STORAGE_KEY_WS_URL);
  if (stored) return stored;
  return resolveWsUrl();
}

export function setWsUrl(url: string): void {
  writeStorage(STORAGE_KEY_WS_URL, url);
}

// -- Module-level defaults (used at import time; prefer getters at runtime) --

export const wsUrl: string = resolveWsUrl();

export const workerType: WorkerType =
  (process.env.HOTPLEX_WEBCHAT_WORKER_TYPE as WorkerType) ?? "claude_code";

/** @deprecated Use getApiKey() for runtime reads. */
export const apiKey: string =
  process.env.HOTPLEX_WEBCHAT_API_KEY ?? "dev";

// -- Per-session init config -------------------------------------------

export const workDir: string =
  process.env.HOTPLEX_WEBCHAT_WORK_DIR ?? "";

export const rawAllowedTools: string =
  process.env.HOTPLEX_WEBCHAT_ALLOWED_TOOLS ?? "";

export const allowedTools: string[] = rawAllowedTools
  ? rawAllowedTools.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

// -- Derived -----------------------------------------------------------

export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export function httpBase(): string {
  return (
    wsUrl
      .replace(/^ws:\/\//, "http://")
      .replace(/^wss:\/\//, "https://")
      .replace(/\/ws\/?$/, "")
  );
}

// -- Admin -----------------------------------------------------------------

export const adminUrl: string =
  process.env.HOTPLEX_WEBCHAT_ADMIN_URL ?? 'http://localhost:9090';
