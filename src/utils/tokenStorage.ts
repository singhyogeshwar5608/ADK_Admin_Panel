import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/config/constants";

const canUseDom = () => typeof window !== "undefined";

export const tokenStorage = {
  setTokens(access: string, refresh: string) {
    if (!canUseDom()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  getAccessToken(): string | null {
    if (!canUseDom()) return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (!canUseDom()) return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  clearTokens() {
    if (!canUseDom()) return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
