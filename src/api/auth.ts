import type { AuthMeResponse, LoginPayload, LoginResponse } from "@/types/member";
import { tokenStorage } from "@/utils/tokenStorage";
import { api } from "./client";

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", payload);
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function fetchCurrentMember() {
  const { data } = await api.get<AuthMeResponse>("/auth/me");
  return data.member;
}

export function logoutLocal() {
  tokenStorage.clearTokens();
}
