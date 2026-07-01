import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const src = path.join(fileURLToPath(new URL(".", import.meta.url)), "src");

/** When `VITE_API_URL` / `VITE_API_BASE_URL` is absolute, proxy same-origin dev requests to that API (no browser CORS). */
function devApiProxy(apiBaseRaw: string): Record<string, ProxyOptions> | undefined {
  const apiBase = apiBaseRaw.trim();
  if (!/^https?:\/\//i.test(apiBase)) return undefined;
  try {
    const u = new URL(apiBase);
    const origin = `${u.protocol}//${u.host}`;
    const prefix = (u.pathname.replace(/\/+$/, "") || "/api/v1").replace(/\/+$/, "") || "/api/v1";
    return {
      [prefix]: {
        target: origin,
        changeOrigin: true,
        secure: u.protocol === "https:",
      },
    };
  } catch {
    return undefined;
  }
}

/** Relative `/api/v1` in dev — forward to `VITE_DEV_PROXY_TARGET`. */
function devRelativeApiProxy(apiBaseRaw: string, proxyTarget: string): Record<string, ProxyOptions> | undefined {
  const apiBase = apiBaseRaw.trim();
  if (!apiBase.startsWith("/")) return undefined;
  const prefix = apiBase.replace(/\/+$/, "") || "/api/v1";
  const target = proxyTarget.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(target)) return undefined;
  return {
    [prefix]: {
      target,
      changeOrigin: true,
      secure: target.startsWith("https:"),
    },
  };
}

/** Netlify serves bridge pages (signup, wishlist, product) as static HTML. Mirror that in dev. */
function bridgePages(): { name: string; configureServer(v: { middlewares: Connect.Server }): void } {
  return {
    name: "bridge-pages",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "";
        // Normalise query params: /signup?ref=… → /signup/index.html
        if (url === "/signup" || url === "/signup/") req.url = "/signup/index.html";
        else if (url === "/wishlist" || url === "/wishlist/") req.url = "/wishlist/index.html";
        else if (url === "/w" || url === "/w/") req.url = "/wishlist/index.html";
        else if (url === "/product" || url === "/product/") req.url = "/product/index.html";
        else if (url.startsWith("/wishlist/")) req.url = "/wishlist/index.html";
        else if (url.startsWith("/w/")) req.url = "/wishlist/index.html";
        else if (url.startsWith("/product/")) req.url = "/product/index.html";
        else if (url.startsWith("/members/signup")) req.url = "/signup/index.html";
        else if (url.startsWith("/members/w/")) req.url = "/wishlist/index.html";
        else if (url.startsWith("/members/wishlist")) req.url = "/wishlist/index.html";
        else if (url.startsWith("/members/product")) req.url = "/product/index.html";
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = (env.VITE_API_URL ?? env.VITE_API_BASE_URL ?? "").trim();
  const proxyTarget = env.VITE_DEV_PROXY_TARGET ?? "https://www.offerlifetime.com";

  const proxy =
    mode === "development"
      ? (devApiProxy(apiBase) ?? devRelativeApiProxy(apiBase, proxyTarget))
      : undefined;

  return {
    plugins: [react(), bridgePages()],
    resolve: {
      alias: { "@": src },
    },
    server: {
      port: 5173,
      proxy,
    },
  };
});
