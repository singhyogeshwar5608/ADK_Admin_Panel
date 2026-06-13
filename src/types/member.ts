export type MemberRole = "ADMIN" | "MEMBER";
export type MemberType = "LEADER" | "USER";

export interface Member {
  id: number | string;
  role: MemberRole;
  type?: MemberType;
  email?: string;
  name?: string;
  member_id?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface LoginPayload {
  email: string;
  password: string;
  login_as_admin?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  member: Member;
}

export interface AuthMeResponse {
  member: Member;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
