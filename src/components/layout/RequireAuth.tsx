import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Navigate, Outlet, useLocation } from "react-router-dom";

/** Bundle `L2`: gate authenticated area, redirect guests to `/login`. */
export function RequireAuth() {
  const { member, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen message="Authenticating…" />;
  if (!member) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
