import { resolveApiBaseUrl } from "@/config/apiEnv";

function stripQuery(h: string): string {
  const i = h.indexOf("?");
  return i === -1 ? h : h.slice(0, i);
}

/** Absolute API base, e.g. `https://www.example.com/api/v1` or `http://localhost:5173/api/v1` (with proxy). */
function resolveApiBaseAbsolute(): string {
  const base = resolveApiBaseUrl().trim();
  if (!base) return "";
  if (/^https?:\/\//i.test(base)) {
    return base.replace(/\/+$/, "");
  }
  if (base.startsWith("/") && typeof globalThis !== "undefined" && "location" in globalThis && globalThis.location?.origin) {
    try {
      return new URL(base, globalThis.location.origin).href.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }
  return base.replace(/\/+$/, "");
}

/**
 * Product images often use Laravel's **web** route `/storage-proxy/...`, which:
 * - is not covered by the Vite `/api/v1` proxy in dev, and
 * - can be rewritten to `index.html` on SPA hosts in production.
 * The API route `GET /api/v1/media/{path}` serves the same files — route through that so
 * images use the same origin + proxy as the rest of the admin API.
 */
export function resolveMediaUrl(href: string | null | undefined): string | null {
  if (href == null) return null;
  let t = String(href).trim();
  if (t === "") return null;
  if (t.startsWith("blob:") || t.startsWith("data:")) return t;
  if (t.startsWith("//")) {
    if (typeof globalThis !== "undefined" && "location" in globalThis && globalThis.location?.protocol) {
      return `${globalThis.location.protocol}${t}`;
    }
    return `https:${t}`;
  }

  t = stripQuery(t);

  const abs = resolveApiBaseAbsolute();
  const lower = t.toLowerCase();
  const marker = "/storage-proxy/";
  const idx = lower.indexOf(marker);
  if (idx !== -1 && abs) {
    const rest = t.slice(idx + marker.length).replace(/^\/+/, "");
    if (rest) {
      return `${abs}/media/${rest}`;
    }
  }

  // Direct `/storage/...` links (public disk) → same MediaProxyController
  if (abs && lower.includes("/storage/") && !lower.includes("/media/")) {
    const sIdx = lower.indexOf("/storage/");
    const rest = t.slice(sIdx).replace(/^\/+/, ""); // "storage/products/..."
    return `${abs}/media/${rest}`;
  }

  if (/^https?:\/\//i.test(t)) return t;

  if (!abs) {
    return t.startsWith("/") ? t : `/${t}`;
  }

  try {
    const origin = new URL(abs).origin;
    const path = t.startsWith("/") ? t : `/${t}`;
    return `${origin}${path}`;
  } catch {
    return t.startsWith("/") ? t : `/${t}`;
  }
}
