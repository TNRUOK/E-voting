import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* Animated floating particle background */
function Particles() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {[...Array(18)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          borderRadius: "50%",
          background: i % 2 === 0
            ? "rgba(124, 58, 237, 0.12)"
            : "rgba(6, 182, 212, 0.10)",
          width: `${40 + (i * 23) % 120}px`,
          height: `${40 + (i * 23) % 120}px`,
          left: `${(i * 17 + 5) % 100}%`,
          top: `${(i * 13 + 10) % 100}%`,
          animation: `floatParticle ${6 + (i % 5) * 2}s ease-in-out infinite`,
          animationDelay: `${i * 0.4}s`,
          filter: "blur(1px)",
        }} />
      ))}
    </div>
  );
}

export default function Login() {
  const { login, signup, user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]           = useState("login"); // "login" | "signup"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Already logged in → redirect to home
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  function resetForm() {
    setUsername(""); setPassword(""); setConfirm("");
    setError(""); setSuccess("");
  }

  function switchTab(t) { setTab(t); resetForm(); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);

    try {
      if (tab === "signup") {
        if (password !== confirm) {
          setError("Passwords do not match."); setLoading(false); return;
        }
        const result = await signup(username.trim(), password);
        if (!result.ok) { setError(result.error); setLoading(false); return; }
        setSuccess("Account created! Redirecting...");
        setTimeout(() => navigate("/"), 900);
      } else {
        const result = await login(username.trim(), password);
        if (!result.ok) { setError(result.error); setLoading(false); return; }
        setSuccess("Welcome back! Redirecting...");
        setTimeout(() => navigate("/"), 700);
      }
    } finally {
      setLoading(false);
    }
  }

  const isLogin = tab === "login";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      padding: "24px",
    }}>
      <Particles />

      {/* Glow blobs */}
      <div style={{
        position: "fixed", top: "20%", left: "15%",
        width: 340, height: 340,
        background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
        borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: "20%", right: "15%",
        width: 280, height: 280,
        background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
        borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
      }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 460,
        background: "rgba(10, 15, 30, 0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24,
        boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)",
        overflow: "hidden",
      }}>

        {/* Top gradient bar */}
        <div style={{
          height: 4,
          background: "linear-gradient(90deg, #7C3AED 0%, #06B6D4 50%, #10B981 100%)",
        }} />

        <div style={{ padding: "40px 40px 44px" }}>

          {/* Logo / Brand */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 60, height: 60, borderRadius: 16,
              background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
              boxShadow: "0 0 30px rgba(124,58,237,0.4)",
              marginBottom: 16,
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#F8FAFC" }}>
              Threshold <span style={{ color: "#67E8F9" }}>E-Voting</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              (2,3)-Blind RSA · Groth16 zk-SNARK
            </div>
          </div>

          {/* Tab Switcher */}
          <div style={{
            display: "flex",
            background: "rgba(15,23,42,0.8)",
            borderRadius: 10,
            padding: 4,
            marginBottom: 28,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            {["login", "signup"].map(t => (
              <button key={t} onClick={() => switchTab(t)} style={{
                flex: 1, padding: "10px 0",
                border: "none", borderRadius: 8, cursor: "pointer",
                fontSize: "0.9rem", fontWeight: 600,
                transition: "all 0.2s ease",
                background: tab === t
                  ? "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(6,182,212,0.2))"
                  : "transparent",
                color: tab === t ? "#F8FAFC" : "#64748B",
                boxShadow: tab === t ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                borderBottom: tab === t ? "2px solid #7C3AED" : "2px solid transparent",
              }}>
                {t === "login" ? "🔑 Sign In" : "✨ Create Account"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} autoComplete="off">

            {/* Username */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 600, color: "#94A3B8", marginBottom: 8 }}>
                Username
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#475569" }}>
                  👤
                </span>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoFocus
                  style={{
                    width: "100%", padding: "12px 16px 12px 42px",
                    background: "rgba(15,23,42,0.9)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10, color: "#F8FAFC",
                    fontSize: "0.95rem", fontFamily: "inherit",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    outline: "none",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#7C3AED"; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.18)"; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: isLogin ? 24 : 18 }}>
              <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 600, color: "#94A3B8", marginBottom: 8 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#475569" }}>
                  🔒
                </span>
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isLogin ? "Enter your password" : "Create a password (min 6 chars)"}
                  required
                  style={{
                    width: "100%", padding: "12px 44px 12px 42px",
                    background: "rgba(15,23,42,0.9)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10, color: "#F8FAFC",
                    fontSize: "0.95rem", fontFamily: "inherit",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#7C3AED"; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.18)"; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 15, padding: 4,
                }}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Confirm Password (signup only) */}
            {!isLogin && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 600, color: "#94A3B8", marginBottom: 8 }}>
                  Confirm Password
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#475569" }}>
                    ✅
                  </span>
                  <input
                    id="login-confirm"
                    type={showPass ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    style={{
                      width: "100%", padding: "12px 16px 12px 42px",
                      background: "rgba(15,23,42,0.9)",
                      border: `1px solid ${confirm && password && confirm !== password ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 10, color: "#F8FAFC",
                      fontSize: "0.95rem", fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onFocus={e => { e.target.style.borderColor = "#7C3AED"; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.18)"; }}
                    onBlur={e => { e.target.style.borderColor = (confirm && password && confirm !== password) ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                {confirm && password && confirm !== password && (
                  <div style={{ fontSize: "0.8rem", color: "#F43F5E", marginTop: 6 }}>
                    ⚠️ Passwords don't match
                  </div>
                )}
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <div style={{
                marginBottom: 18, padding: "11px 16px",
                background: "rgba(244,63,94,0.1)",
                border: "1px solid rgba(244,63,94,0.3)",
                borderRadius: 8, fontSize: "0.88rem", color: "#FDA4AF",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{
                marginBottom: 18, padding: "11px 16px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 8, fontSize: "0.88rem", color: "#6EE7B7",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                ✅ {success}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "14px 0",
              background: loading
                ? "rgba(124,58,237,0.4)"
                : "linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)",
              border: "none", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
              color: "#FFFFFF", fontSize: "1rem", fontWeight: 700,
              letterSpacing: "0.01em", fontFamily: "inherit",
              transition: "all 0.25s ease",
              boxShadow: loading ? "none" : "0 6px 22px rgba(124,58,237,0.4)",
              transform: "translateY(0)",
            }}
              onMouseEnter={e => { if (!loading) { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 8px 26px rgba(124,58,237,0.5)"; }}}
              onMouseLeave={e => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = loading ? "none" : "0 6px 22px rgba(124,58,237,0.4)"; }}
            >
              {loading
                ? "⏳ Processing..."
                : isLogin ? "🔑 Sign In to E-Voting" : "✨ Create Account & Enter"
              }
            </button>
          </form>

          {/* Footer hint */}
          <div style={{ textAlign: "center", marginTop: 22, fontSize: "0.82rem", color: "#475569" }}>
            {isLogin
              ? <>Don't have an account?{" "}
                  <button onClick={() => switchTab("signup")} style={{ background: "none", border: "none", color: "#A78BFA", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem", padding: 0 }}>
                    Create one →
                  </button>
                </>
              : <>Already registered?{" "}
                  <button onClick={() => switchTab("login")} style={{ background: "none", border: "none", color: "#67E8F9", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem", padding: 0 }}>
                    Sign in →
                  </button>
                </>
            }
          </div>

          {/* Privacy note */}
          <div style={{
            marginTop: 24, padding: "12px 16px",
            background: "rgba(6,182,212,0.06)",
            border: "1px solid rgba(6,182,212,0.15)",
            borderRadius: 8, fontSize: "0.78rem", color: "#64748B",
            lineHeight: 1.6,
          }}>
            🔐 <strong style={{ color: "#94A3B8" }}>Privacy:</strong> Your account is stored locally in this browser only.
            Your voting credentials are anonymous — no name is ever linked to a vote on-chain.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
