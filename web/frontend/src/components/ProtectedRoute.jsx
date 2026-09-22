import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps any route that requires authentication.
 * Unauthenticated visitors are redirected to /login with the
 * original `from` path saved so we can redirect back after login.
 */
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location  = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
