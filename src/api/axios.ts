import { resolveApiBaseUrl } from "@/config/apiEnv";
import { tokenStorage } from "@/utils/tokenStorage";
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

const baseURL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL,
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/** Avoid interceptor recursion when refreshing tokens. */
const refreshClient = axios.create({
  baseURL,
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshTokens(): Promise<string | null> {
  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) return null;
  if (!refreshInFlight) {
    refreshInFlight = refreshClient
      .post<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
        refresh_token: refresh,
      })
      .then(({ data }) => {
        tokenStorage.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      })
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 422) {
          tokenStorage.clearTokens();
        }
        throw err;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const headers = AxiosHeaders.from(config.headers ?? {});
  const token = tokenStorage.getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    headers.delete("Content-Type");
  }
  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const data = error.response?.data;
    if (data !== undefined) {
      // eslint-disable-next-line no-console -- required API diagnostics
      console.error("[API] error.response.data", data);
    }
    const ct = error.response?.headers?.["content-type"];
    const looksLikeHtml =
      (typeof data === "string" && /^\s*</.test(data)) ||
      (typeof ct === "string" && ct.includes("text/html"));
    if (looksLikeHtml) {
      // eslint-disable-next-line no-console -- DX when SPA host has no /api route
      console.warn(
        "[API] Response is HTML, not JSON. The request URL likely hits your static frontend host, not Laravel. " +
          "Point VITE_API_URL (and Vite dev proxy) at the real API host (e.g. https://api.yourdomain.com with web root = Laravel public/).",
      );
    }

    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (!original || original._retry) return Promise.reject(error);

    const status = error.response?.status;
    if (status === 403) {
      return Promise.reject(error);
    }
    if (status !== 401) return Promise.reject(error);

    original._retry = true;
    try {
      const access = await refreshTokens();
      if (!access) {
        tokenStorage.clearTokens();
        return Promise.reject(error);
      }
      const headers = AxiosHeaders.from(original.headers ?? {});
      headers.set("Authorization", `Bearer ${access}`);
      original.headers = headers;
      return api(original);
    } catch {
      return Promise.reject(error);
    }
  },
);
