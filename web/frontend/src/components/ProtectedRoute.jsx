import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute
 *
 * Props:
 *   children      — content to render when access is granted
 *   requireAdmin  — if true, also enforces role === 'admin'
 *
 * Redirect behaviour:
 *   - Unauthenticated → /login  (saves `from` for post-login redirect)
 *   - Authenticated but not admin (when requireAdmin=true) → / (home)
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
