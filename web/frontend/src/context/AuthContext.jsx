import React, { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

// Simple deterministic hash (djb2) — good enough for a local demo
// NOT for production — use bcrypt or Argon2 on a real backend
function hashPassword(password) {
  let hash = 5381n;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash * 33n) ^ BigInt(password.charCodeAt(i))) & 0xFFFFFFFFFFFFFFFFn;
  }
  return hash.toString(16);
}

const USERS_KEY  = "evoting_users";   // { [username]: { username, passwordHash, createdAt } }
const SESSION_KEY = "evoting_session"; // { username, loginAt }

function getUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
    // Ensure default admin account exists
    if (!users["admin"]) {
      users["admin"] = {
        username: "admin",
        passwordHash: hashPassword("admin123"),
        role: "admin",
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return users;
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    getUsers(); // ensure admin exists
    return getSession();
  });

  const signup = useCallback((username, password) => {
    if (!username || username.length < 3)
      return { ok: false, error: "Username must be at least 3 characters." };
    if (!password || password.length < 6)
      return { ok: false, error: "Password must be at least 6 characters." };

    const users = getUsers();
    if (users[username.toLowerCase()])
      return { ok: false, error: "Username already taken. Try logging in." };

    const role = username.toLowerCase() === "admin" ? "admin" : "voter";
    const newUser = {
      username,
      role,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    users[username.toLowerCase()] = newUser;
    saveUsers(users);

    const sess = { username, role, loginAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    setSession(sess);
    return { ok: true };
  }, []);

  const login = useCallback((username, password) => {
    const users = getUsers();
    const user  = users[username.toLowerCase()];
    if (!user)
      return { ok: false, error: "No account found. Please sign up first." };
    if (user.passwordHash !== hashPassword(password))
      return { ok: false, error: "Incorrect password. Please try again." };

    const role = user.role || (user.username.toLowerCase() === "admin" ? "admin" : "voter");
    const sess = { username: user.username, role, loginAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    setSession(sess);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const isAdmin = session?.role === "admin" || session?.username?.toLowerCase() === "admin";

  return (
    <AuthContext.Provider value={{ session, user: session?.username ?? null, role: session?.role ?? "voter", isAdmin, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
