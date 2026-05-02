/**
 * Axios `baseURL` from `VITE_API_URL` (preferred) or legacy `VITE_API_BASE_URL`.
 * - If only origin is provided (e.g. https://www.offerlifetime.com),
 *   it automatically appends `/api/v1`.
 * - ALWAYS returns full URL (no dev proxy conversion).
 */

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

function normalizeToApiBase(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  // If already relative path (not recommended)
  if (s.startsWith("/")) {
    return trimTrailingSlashes(s);
  }

  try {
    const u = new URL(s);

    let path = (u.pathname || "").replace(/\/+$/, "");

    // If no path → add /api/v1
    if (!path || path === "/") {
      path = "/api/v1";
    }

    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return trimTrailingSlashes(s);
  }
}

export function resolveApiBaseUrl(): string {
  const raw =
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    "";

  if (!raw) {
    console.warn("[API] Missing VITE_API_URL in .env");
    return "";
  }

  // 🔥 ALWAYS return full URL (NO DEV PATH CONVERSION)
  return normalizeToApiBase(raw);
}