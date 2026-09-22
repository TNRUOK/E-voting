import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const [registrarsUp, setRegistrarsUp] = useState({ online: 0, total: 3 });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/registrars/status");
        if (res.ok) {
          const data = await res.json();
          const onlineCount = (data.registrars || []).filter(r => r.online).length;
          setRegistrarsUp({ online: onlineCount, total: 3 });
        }
      } catch { /* backend may be offline */ }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    setDropdownOpen(false);
    logout();
    navigate("/login");
  }

  const navLinks = [
    { to: "/",           label: "Overview" },
    { to: "/register",   label: "Register" },
    { to: "/vote",       label: "Cast Ballot" },
    { to: "/dashboard",  label: "Dashboard" },
    { to: "/simulation", label: "Simulation" },
    { to: "/admin",      label: "👑 Admin Audit" },
  ];

  // Avatar initials from username
  const initials = user
    ? user.slice(0, 2).toUpperCase()
    : "?";

  return (
    <header style={{
      borderBottom: "1px solid var(--border-subtle)",
      background: "rgba(10, 15, 30, 0.85)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1240, margin: "0 auto",
        padding: "14px 24px",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>

        {/* Brand */}
        <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 15px rgba(124, 58, 237, 0.4)",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em", color: "#F8FAFC" }}>
              Threshold <span style={{ color: "var(--accent-cyan-light)" }}>E-Voting</span>
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              (2,3)-Blind RSA + Groth16
            </div>
          </div>
        </Link>

        {/* Navigation links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link key={link.to} to={link.to} style={{
                textDecoration: "none",
                padding: "7px 13px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.87rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#FFFFFF" : "var(--text-muted)",
                background: isActive ? "rgba(124, 58, 237, 0.2)" : "transparent",
                border: isActive ? "1px solid rgba(124, 58, 237, 0.4)" : "1px solid transparent",
                transition: "all 0.15s ease",
              }}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: registrar status + user menu */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {/* Registrar indicator */}
          <div className="badge badge-purple" style={{ textTransform: "none", fontSize: "0.78rem", padding: "5px 12px" }}>
            <span className="pulse-dot" style={{
              background: registrarsUp.online >= 2 ? "var(--accent-emerald)" : "var(--accent-amber)",
              boxShadow: `0 0 8px ${registrarsUp.online >= 2 ? "var(--accent-emerald)" : "var(--accent-amber)"}`
            }} />
            <span>{registrarsUp.online}/{registrarsUp.total} Registrars</span>
          </div>

          {/* User avatar + dropdown */}
          {user && (
            <div ref={dropRef} style={{ position: "relative" }}>
              <button
                id="user-menu-btn"
                onClick={() => setDropdownOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: dropdownOpen
                    ? "rgba(124,58,237,0.25)"
                    : "rgba(255,255,255,0.05)",
                  border: "1px solid " + (dropdownOpen ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.1)"),
                  borderRadius: 10, padding: "6px 12px 6px 6px",
                  cursor: "pointer", transition: "all 0.2s ease",
                  color: "#F8FAFC",
                }}
                onMouseEnter={e => { if (!dropdownOpen) { e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)"; e.currentTarget.style.background = "rgba(124,58,237,0.15)"; }}}
                onMouseLeave={e => { if (!dropdownOpen) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}}
              >
                {/* Avatar circle */}
                <div style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 800, color: "#FFF",
                  boxShadow: "0 0 10px rgba(124,58,237,0.4)",
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
                <span style={{ fontSize: "0.88rem", fontWeight: 600, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{
                  transition: "transform 0.2s",
                  transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  color: "#94A3B8", flexShrink: 0,
                }}>
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  width: 200,
                  background: "rgba(10,15,30,0.98)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  boxShadow: "0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1)",
                  overflow: "hidden",
                  animation: "dropdownFadeIn 0.15s ease",
                  zIndex: 200,
                }}>
                  {/* User info header */}
                  <div style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(124,58,237,0.08)",
                  }}>
                    <div style={{ fontSize: "0.72rem", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                      Signed in as
                    </div>
                    <div style={{ fontWeight: 700, color: "#F8FAFC", fontSize: "0.95rem" }}>
                      {user}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: isAdmin ? "#F59E0B" : "#10B981", display: "inline-block", boxShadow: `0 0 6px ${isAdmin ? "#F59E0B" : "#10B981"}` }} />
                      <span style={{ fontSize: "0.75rem", color: isAdmin ? "#FBBF24" : "#34D399", fontWeight: 600 }}>
                        {isAdmin ? "👑 System Administrator" : "Anonymous Voter"}
                      </span>
                    </div>
                  </div>

                  {/* Menu items */}
                  {[
                    { label: "🏠 Overview",      path: "/" },
                    { label: "📋 Register",      path: "/register" },
                    { label: "🗳️  Cast Ballot",   path: "/vote" },
                    { label: "📊 Dashboard",     path: "/dashboard" },
                    { label: "👑 Admin Portal",  path: "/admin" },
                  ].map(item => (
                    <button key={item.path} onClick={() => { navigate(item.path); setDropdownOpen(false); }} style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "10px 16px", background: "none", border: "none",
                      color: "#94A3B8", fontSize: "0.88rem", cursor: "pointer",
                      transition: "background 0.15s, color 0.15s",
                      fontFamily: "inherit",
                    }}
                      onMouseEnter={e => { e.target.style.background = "rgba(124,58,237,0.12)"; e.target.style.color = "#F8FAFC"; }}
                      onMouseLeave={e => { e.target.style.background = "none"; e.target.style.color = "#94A3B8"; }}
                    >
                      {item.label}
                    </button>
                  ))}

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <button id="logout-btn" onClick={handleLogout} style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "11px 16px", background: "none", border: "none",
                      color: "#F43F5E", fontSize: "0.88rem", cursor: "pointer",
                      fontWeight: 600, fontFamily: "inherit",
                      transition: "background 0.15s",
                    }}
                      onMouseEnter={e => { e.target.style.background = "rgba(244,63,94,0.1)"; }}
                      onMouseLeave={e => { e.target.style.background = "none"; }}
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </header>
  );
}
