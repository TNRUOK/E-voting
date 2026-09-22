import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const AuthContext = createContext(null);

const API_BASE   = "http://localhost:3000";
const TOKEN_KEY  = "evoting_jwt";
const SESSION_KEY = "evoting_session";

// ── Token helpers ─────────────────────────────────────────────────────────────
function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

/** Decode JWT payload without verifying (verification is done server-side) */
function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/** Returns true if the JWT has expired */
function isExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  return Date.now() / 1000 > decoded.exp;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function authFetch(endpoint, body) {
  const res = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
    method  : "POST",
    headers : { "Content-Type": "application/json" },
    body    : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── AuthProvider ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const token = getToken();
    if (!token || isExpired(token)) {
      clearToken();
      return null;
    }
    const decoded = decodeToken(token);
    return decoded ? { username: decoded.username, role: decoded.role } : null;
  });

  // Periodically check for token expiry
  useEffect(() => {
    const id = setInterval(() => {
      const token = getToken();
      if (token && isExpired(token)) {
        clearToken();
        setSession(null);
      }
    }, 60_000); // every minute
    return () => clearInterval(id);
  }, []);

  /**
   * signup(username, password)
   * Returns { ok: true } or { ok: false, error: string }
   */
  const signup = useCallback(async (username, password) => {
    try {
      const data = await authFetch("signup", { username, password });
      saveToken(data.token);
      setSession({ username: data.username, role: data.role });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  /**
   * login(username, password)
   * Returns { ok: true } or { ok: false, error: string }
   */
  const login = useCallback(async (username, password) => {
    try {
      const data = await authFetch("login", { username, password });
      saveToken(data.token);
      setSession({ username: data.username, role: data.role });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setSession(null);
  }, []);

  /**
   * authedFetch(url, options?)
   * Thin wrapper around window.fetch that injects the Bearer token.
   * Use this anywhere you need to call a protected API endpoint.
   */
  const authedFetch = useCallback(async (url, options = {}) => {
    const token = getToken();
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      clearToken();
      setSession(null);
    }
    return res;
  }, []);

  const isAdmin = session?.role === "admin";

  return (
    <AuthContext.Provider value={{
      session,
      user    : session?.username ?? null,
      role    : session?.role ?? "voter",
      isAdmin,
      login,
      signup,
      logout,
      authedFetch,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
