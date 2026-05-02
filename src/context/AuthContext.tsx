import { fetchCurrentMember, loginRequest, logoutLocal } from "@/api/auth";
import type { LoginPayload, Member } from "@/types/member";
import { tokenStorage } from "@/utils/tokenStorage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AuthContextValue {
  member: Member | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenStorage.getAccessToken()) {
      setIsLoading(false);
      return;
    }
    fetchCurrentMember()
      .then(setMember)
      .catch(() => {
        tokenStorage.clearTokens();
        setMember(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await loginRequest(payload);
    setMember(res.member);
  }, []);

  const logout = useCallback(() => {
    logoutLocal();
    setMember(null);
  }, []);

  const value = useMemo(
    () => ({ member, isLoading, login, logout }),
    [member, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
