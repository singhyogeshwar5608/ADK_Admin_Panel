import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

/** Bundle `O2`: root path sends users to dashboard or catalogue area. */
export function HomeRedirect() {
  const { member } = useAuth();
  if (member?.role === "ADMIN") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/products" replace />;
}
