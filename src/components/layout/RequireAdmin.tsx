import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/** Bundle `I2`: only `ADMIN` may access nested admin routes. */
export function RequireAdmin() {
  const { member } = useAuth();
  if (member?.role !== "ADMIN") return <Navigate to="/products" replace />;
  return <Outlet />;
}
