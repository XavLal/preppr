import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getAuthToken } from "@/lib/authToken";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
