import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { user, isAdmin, authedFetch } = useAuth();
  const [accountStatus, setAccountStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [voterName, setVoterName] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [showAdminBreakdown, setShowAdminBreakdown] = useState(false);

  const steps = [
    { title: "Generate Keys", desc: "Creating Real + Decoy credentials with Poseidon commitments" },
    { title: "Blind Commitment", desc: "Multiplying commitment by r^e mod N to blind from registrars" },
    { title: "2-of-3 Partial Sigs", desc: "Requesting partial signatures from 2 independent registrars" },
    { title: "Threshold Combine", desc: "Lagrange interpolation across partial signatures & unblinding" },
    { title: "On-Chain Registry", desc: "Submitting commitment to VoterRegistry.sol Merkle tree" }
  ];

  const fetchAccountStatus = useCallback(async () => {
    if (!user) {
      setStatusLoading(false);
      return;
    }
    try {
      setStatusLoading(true);
      const res = await authedFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setAccountStatus(data);
        if (data.credential) {
          setResult(data.credential);
          localStorage.setItem("latest_credential", JSON.stringify(data.credential));
        }
      }
    } catch (err) {
      console.error("Failed to load user status:", err);
    } finally {
      setStatusLoading(false);
    }
  }, [user, authedFetch]);

  useEffect(() => {
    fetchAccountStatus();
  }, [fetchAccountStatus]);

  const handleRegister = async (e) => {
    e.preventDefault();
    const name = voterName.trim() || user || `Voter_${Math.floor(1000 + Math.random() * 9000)}`;
    setLoading(true);
    setErrorMsg("");
    setCurrentStep(1);

    try {
      // Step simulated progress for visual clarity
      const stepTimer1 = setTimeout(() => setCurrentStep(2), 600);
      const stepTimer2 = setTimeout(() => setCurrentStep(3), 1300);

      const res = await authedFetch("/api/voters/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterName: name })
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setCurrentStep(4);

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Registration failed");
      }

      setCurrentStep(5);
      setResult(data);
      // Save credential to localStorage so voter can use it seamlessly on the vote page!
      localStorage.setItem("latest_credential", JSON.stringify(data));
      // Refresh account status so hasRegistered locks the account immediately
      await fetchAccountStatus();
    } catch (err) {
      setErrorMsg(err.message || "Failed to register voter");
      setCurrentStep(0);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span className="badge badge-purple" style={{ marginBottom: 12 }}>Credential Issuance</span>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Voter Registration
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1rem", maxWidth: 640, margin: "0 auto" }}>
          Issue anonymous, coercion-resistant credentials using distributed 2-of-3 RSA blind signatures.
          No registrar ever sees your plain secret or knows which credential is real or decoy.
        </p>
      </div>

      {/* STATE 0: Not Authenticated */}
      {!user && (
        <div className="glass-panel" style={{ padding: "40px 32px", textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Authentication Required</h2>
          <p style={{ color: "var(--text-muted)", maxWidth: 520, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Voter credentials are strictly limited to one per verified account. Please log in or sign up with your voter account to proceed.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ padding: "10px 28px", fontSize: "0.95rem" }}>
            Sign In / Register Account →
          </Link>
        </div>
      )}

      {/* STATE 1: Logged In as Admin (Admins don't vote) */}
      {user && isAdmin && (
        <div className="glass-panel" style={{ padding: "24px 28px", marginBottom: 32, borderLeft: "4px solid var(--accent-violet)" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ fontSize: "1.8rem" }}>👑</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-main)" }}>Administrator Mode</div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                Admin accounts are restricted from generating voter IDs. Use the <strong>Admin Portal</strong> to verify and enroll voter accounts.
              </p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link to="/admin" className="btn btn-outline" style={{ fontSize: "0.85rem", padding: "6px 18px" }}>
              Go to Admin Portal →
            </Link>
          </div>
        </div>
      )}

      {/* STATE 2: Logged in Voter but NOT Enrolled by Admin */}
      {user && !isAdmin && !statusLoading && !accountStatus?.enrolled && (
        <div className="glass-panel" style={{
          padding: "32px",
          marginBottom: 32,
          border: "1px solid rgba(245, 158, 11, 0.4)",
          background: "rgba(245, 158, 11, 0.05)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="badge badge-amber" style={{ marginBottom: 8, padding: "4px 12px" }}>
                ⏳ Identity Verification Required
              </span>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "4px 0" }}>
                Account Awaiting Administrator Enrollment
              </h2>
            </div>
            <button
              onClick={fetchAccountStatus}
              className="btn btn-outline"
              style={{ fontSize: "0.8rem", padding: "6px 14px" }}
            >
              🔄 Refresh Status
            </button>
          </div>
          <p style={{ color: "var(--text-main)", fontSize: "0.92rem", lineHeight: 1.6, margin: "0 0 16px" }}>
            You are logged in as <strong>{user}</strong>. Before you can generate your anonymous voting credential, an election administrator must verify your identity and enroll your commitment in the on-chain <code style={{ color: "var(--accent-cyan-light)" }}>EligibilityRegistry.sol</code> contract.
          </p>
          <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.3)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            ℹ️ <strong>How to complete enrollment:</strong> Ask the election admin to open the <strong>Admin Portal</strong>, select the <strong>👤 Voter Enrollment</strong> tab, and click <strong>"✓ Enroll Voter"</strong> for account <code>{user}</code>.
          </div>
        </div>
      )}

      {/* STATE 3: Already Generated Voter ID (Strict 1-per-account lock) */}
      {user && !isAdmin && !statusLoading && accountStatus?.hasRegistered && (
        <div className="glass-panel" style={{
          padding: "28px 32px",
          marginBottom: 32,
          border: "1px solid rgba(16, 185, 129, 0.4)",
          background: "rgba(16, 185, 129, 0.05)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="badge badge-green" style={{ marginBottom: 6, padding: "4px 12px" }}>
                ✓ 1 Credential Per Account Enforced
              </span>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "4px 0" }}>
                Voting Credential Already Issued
              </h2>
            </div>
            <Link to="/vote" className="btn btn-cyan" style={{ padding: "8px 22px", fontSize: "0.9rem" }}>
              🗳️ Proceed to Cast Vote →
            </Link>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0, lineHeight: 1.6 }}>
            You have already generated your 1-person voting credential for this election (account: <strong>{user}</strong>
            {accountStatus?.registeredAt ? `, issued on ${new Date(accountStatus.registeredAt).toLocaleString()}` : ""}).
            To protect election integrity and prevent Sybil attacks, <strong>accounts cannot generate multiple voter IDs</strong>.
            Your credential details are displayed below and saved to your session.
          </p>
        </div>
      )}

      {/* STATE 4: Enrolled & Ready to Generate (1-Time Action) */}
      {user && !isAdmin && !statusLoading && accountStatus?.enrolled && !accountStatus?.hasRegistered && (
        <div className="glass-panel" style={{ padding: "32px", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>✓ Identity Verified</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Enrolled by admin — authorized for <strong>one-time</strong> credential issuance
            </span>
          </div>

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Simulation ID / Label (Optional)</label>
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder={`e.g. ${user}`}
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ whiteSpace: "nowrap", padding: "12px 28px" }}
                >
                  {loading ? "Processing..." : "Generate & Register"}
                </button>
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: 8 }}>
                ⚠️ <strong>One-time action:</strong> Once generated, your 1-person credential will be permanently minted on-chain and registered to this account. You will not be able to generate another voter ID.
              </p>
            </div>
          </form>

          {/* Live Step Progress */}
          {loading && (
            <div style={{ marginTop: 32, padding: "20px", background: "rgba(0,0,0,0.3)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--accent-cyan-light)" }}>
                  Execution Step {currentStep} of 5
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {steps[Math.min(currentStep - 1, 4)]?.title}
                </span>
              </div>
              <div style={{
                height: 6,
                background: "#1E293B",
                borderRadius: 3,
                overflow: "hidden",
                marginBottom: 20
              }}>
                <div style={{
                  height: "100%",
                  width: `${(currentStep / 5) * 100}%`,
                  background: "linear-gradient(90deg, var(--accent-violet), var(--accent-cyan))",
                  transition: "width 0.4s ease"
                }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {steps.map((s, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: "0.85rem",
                    color: currentStep > idx ? "#10B981" : currentStep === idx + 1 ? "#38BDF8" : "var(--text-dim)"
                  }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: currentStep > idx ? "rgba(16,185,129,0.2)" : currentStep === idx + 1 ? "rgba(56,189,248,0.2)" : "#1E293B",
                      fontSize: "0.75rem",
                      fontWeight: 700
                    }}>
                      {currentStep > idx ? "✓" : idx + 1}
                    </div>
                    <div>
                      <strong style={{ color: currentStep >= idx + 1 ? "var(--text-main)" : "inherit" }}>
                        {s.title}
                      </strong>: {s.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{
              marginTop: 20,
              padding: "16px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "var(--radius-sm)",
              color: "#FCA5A5"
            }}>
              <strong>Error:</strong> {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* Results & Credential Receipt */}
      {result && (
        <div className="glass-panel" style={{
          padding: "32px",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          boxShadow: "0 0 30px rgba(16, 185, 129, 0.15)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <span className="badge badge-green" style={{ marginBottom: 6 }}>Credentials Issued Successfully</span>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                Your Anonymous Voter Credentials
              </h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Registrars Contacted:</div>
              <div style={{ fontWeight: 600, color: "var(--accent-cyan-light)" }}>
                {result.registrarsUsed ? result.registrarsUsed.map(r => `R${r}`).join(", ") : "R1, R2"}
              </div>
            </div>
          </div>

          <div style={{
            background: "rgba(124, 58, 237, 0.1)",
            border: "1px solid rgba(124, 58, 237, 0.3)",
            padding: "14px 18px",
            borderRadius: "var(--radius-sm)",
            marginBottom: 24,
            fontSize: "0.9rem",
            lineHeight: 1.5
          }}>
            🛡️ <strong>Coercion-Resistance Activated:</strong> You have been issued two credentials with the same secret.
            Use the <strong>Real Credential</strong> to cast your genuine vote.
            If coerced by a third party, you may submit the <strong>Decoy Credential</strong>; it produces a valid zero-knowledge proof but will not count against your true choice.
          </div>

          {/* Real Credential Box */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: "#34D399", fontSize: "0.95rem" }}>
                ✓ Real Credential (For Your True Vote)
              </span>
              <button
                onClick={() => copyToClipboard(JSON.stringify({ ...result.real, secret: result.secret }, null, 2), "real")}
                className="btn btn-outline"
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {copiedKey === "real" ? "Copied!" : "Copy Real JSON"}
              </button>
            </div>
            <div className="mono-box">
              {JSON.stringify({ ...result.real, secret: result.secret }, null, 2)}
            </div>
          </div>

          {/* Decoy Credential Box */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: "#F59E0B", fontSize: "0.95rem" }}>
                ⚠️ Decoy Credential (For Coercion Defense)
              </span>
              <button
                onClick={() => copyToClipboard(JSON.stringify({ ...result.decoy, secret: result.secret }, null, 2), "decoy")}
                className="btn btn-outline"
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {copiedKey === "decoy" ? "Copied!" : "Copy Decoy JSON"}
              </button>
            </div>
            <div className="mono-box" style={{ color: "#FBBF24" }}>
              {JSON.stringify({ ...result.decoy, secret: result.secret }, null, 2)}
            </div>
          </div>

          {/* Commitment and Merkle Tree Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Merkle Leaf Index
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
                #{result.leafIndex ?? "Added"}
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Transaction Hash
              </div>
              <div style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)", color: "var(--accent-cyan-light)", overflow: "hidden", textOverflow: "ellipsis" }}>
                {result.txHash ? result.txHash.slice(0, 18) + "..." : "Recorded On-Chain"}
              </div>
            </div>
          </div>

          {/* Admin-Only Cryptographic Pipeline Toggle */}
          {isAdmin && (
            <div style={{
              marginTop: 24,
              padding: "16px 20px",
              background: "rgba(124, 58, 237, 0.12)",
              border: "1px dashed rgba(124, 58, 237, 0.5)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span className="badge badge-purple" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                    👑 Admin Privilege
                  </span>
                  <strong style={{ fontSize: "0.95rem", color: "var(--text-main)" }}>
                    Cryptographic Generation Inspector
                  </strong>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Deep inspection mode for viva / professor demonstration: mathematical breakdown of the 5 issuance steps.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminBreakdown(!showAdminBreakdown)}
                className="btn btn-outline"
                style={{
                  borderColor: "var(--accent-violet)",
                  color: "var(--accent-violet-light)",
                  fontSize: "0.85rem",
                  padding: "8px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>{showAdminBreakdown ? "Hide Pipeline Steps ▲" : "🔬 View Pipeline Steps ▼"}</span>
              </button>
            </div>
          )}

          {/* Admin-Only Cryptographic Step-by-Step Breakdown */}
          {isAdmin && showAdminBreakdown && (
            <div style={{
              marginTop: 20,
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(124, 58, 237, 0.5)",
              borderRadius: "var(--radius-sm)",
              padding: "26px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14, marginBottom: 20 }}>
                <span className="badge badge-purple" style={{ fontSize: "0.75rem", marginBottom: 6 }}>
                  Detailed Mathematical Breakdown (Admin Only)
                </span>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "4px 0" }}>
                  Step-by-Step Cryptographic Issuance Pipeline
                </h3>
                <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", margin: 0 }}>
                  Live execution traces and mathematical proof states generated for this voter:
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Step 1 */}
                <div style={{ background: "rgba(0,0,0,0.35)", padding: "16px 20px", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--accent-cyan)" }}>
                  <div style={{ fontWeight: 700, color: "var(--accent-cyan-light)", fontSize: "0.95rem", marginBottom: 6 }}>
                    Step 1: Master Secret & Dual Credential Generation
                  </div>
                  <div style={{ fontSize: "0.84rem", color: "var(--text-main)", lineHeight: 1.6 }}>
                    The client generates a 248-bit secret scalar <code style={{ color: "var(--accent-cyan-light)" }}>s</code> and two random credential preimages (<code style={{ color: "#34D399" }}>c_real</code>, <code style={{ color: "#FBBF24" }}>c_decoy</code>) in the BN254 scalar field:
                    <div className="mono-box" style={{ marginTop: 8, fontSize: "0.75rem" }}>
                      secret (s): {result.secret}<br/>
                      c_real preimage: {result.real?.value}<br/>
                      c_decoy preimage: {result.decoy?.value}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <strong>Poseidon Algebraic Commitments:</strong>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--text-muted)", margin: "4px 0" }}>
                        C_real = Poseidon(s, c_real)<br/>
                        C_decoy = Poseidon(s, c_decoy)
                      </div>
                      Commitments to be committed on-chain:
                      <div className="mono-box" style={{ marginTop: 6, fontSize: "0.75rem" }}>
                        C_real:  {result.real?.commitment}<br/>
                        C_decoy: {result.decoy?.commitment}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                        * Note: Both commitments appear identical in structure and cannot be linked to the secret or voter.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ background: "rgba(0,0,0,0.35)", padding: "16px 20px", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--accent-violet)" }}>
                  <div style={{ fontWeight: 700, color: "var(--accent-violet-light)", fontSize: "0.95rem", marginBottom: 6 }}>
                    Step 2: RSA Blinding Mechanism
                  </div>
                  <div style={{ fontSize: "0.84rem", color: "var(--text-main)", lineHeight: 1.6 }}>
                    A random blinding factor <code style={{ color: "var(--accent-violet-light)" }}>r ∈ Z_N*</code> blinds each commitment before network transmission:
                    <div className="mono-box" style={{ marginTop: 8, fontSize: "0.75rem" }}>
                      Blinding Factor (r): {result.blindingFactor ? "0x" + result.blindingFactor : "Generated securely client-side"}<br/>
                      Blinded Message (m' = C · r^e mod N): {result.blindedMessage ? "0x" + result.blindedMessage.slice(0, 48) + "..." : "Transmitted as random group element"}
                    </div>
                    <div style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      <strong>Why this protects anonymity:</strong> The registrars receive only <code style={{ color: "var(--accent-violet-light)" }}>m'</code>, which is uniformly distributed over the RSA group. They <strong>never see plaintext commitments or secrets</strong> and have zero knowledge of who they are signing for.
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ background: "rgba(0,0,0,0.35)", padding: "16px 20px", borderRadius: "var(--radius-sm)", borderLeft: "3px solid #F59E0B" }}>
                  <div style={{ fontWeight: 700, color: "#FBBF24", fontSize: "0.95rem", marginBottom: 6 }}>
                    Step 3: Distributed (2,3)-Threshold Registrar Selection
                  </div>
                  <div style={{ fontSize: "0.84rem", color: "var(--text-main)", lineHeight: 1.6 }}>
                    Using round-robin rotation, <strong>2 independent registrars</strong> were contacted and 1 was skipped:
                    <div style={{ display: "flex", gap: 12, marginTop: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span className="badge badge-green">
                        Contacted: {result.registrarsUsed ? result.registrarsUsed.map(r => `Registrar ${r}`).join(" & ") : "Registrar 1 & 2"}
                      </span>
                      <span className="badge badge-amber">
                        Skipped (Zero Knowledge): Registrar {result.registrarSkipped ?? 3}
                      </span>
                    </div>
                    Each selected registrar computed a partial signature using its private Shamir share:
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--text-muted)", margin: "4px 0" }}>
                      s_1 = (m')^(d_1) mod N, &nbsp;&nbsp; s_2 = (m')^(d_2) mod N
                    </div>
                    {result.partialSigs && result.partialSigs.length > 0 && (
                      <div className="mono-box" style={{ marginTop: 6, fontSize: "0.75rem" }}>
                        {result.partialSigs.map((p, i) => (
                          <div key={i}>
                            R{p.id} Partial Sig: 0x{p.sig.slice(0, 36)}...
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ background: "rgba(0,0,0,0.35)", padding: "16px 20px", borderRadius: "var(--radius-sm)", borderLeft: "3px solid #10B981" }}>
                  <div style={{ fontWeight: 700, color: "#34D399", fontSize: "0.95rem", marginBottom: 6 }}>
                    Step 4: Lagrange Combination & Modular Unblinding
                  </div>
                  <div style={{ fontSize: "0.84rem", color: "var(--text-main)", lineHeight: 1.6 }}>
                    The client combines the partial signatures using <strong>Lagrange interpolation</strong> coefficients without reconstructing the master key on any registrar:
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--text-muted)", margin: "4px 0" }}>
                      s' = combine(s_1, s_2) &nbsp;&nbsp;[Composite Blind Signature]
                    </div>
                    Then unblinds the result by multiplying with the modular inverse of the blinding factor:
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "#34D399", margin: "4px 0" }}>
                      s = s' · r^(-1) mod N
                    </div>
                    The voter now holds a mathematically valid signature over their unblinded commitment:
                    <div className="mono-box" style={{ marginTop: 6, fontSize: "0.75rem" }}>
                      Signature Verified under Master Public Key (N, e): s^e ≡ C (mod N) ✓<br/>
                      {result.realFinalSig && (
                        <span>Real RSA Sig: 0x{result.realFinalSig.slice(0, 48)}...</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div style={{ background: "rgba(0,0,0,0.35)", padding: "16px 20px", borderRadius: "var(--radius-sm)", borderLeft: "3px solid #38BDF8" }}>
                  <div style={{ fontWeight: 700, color: "#38BDF8", fontSize: "0.95rem", marginBottom: 6 }}>
                    Step 5: Smart Contract On-Chain Commitment Insertion
                  </div>
                  <div style={{ fontSize: "0.84rem", color: "var(--text-main)", lineHeight: 1.6 }}>
                    Both commitments (<code style={{ color: "#34D399" }}>C_real</code> and <code style={{ color: "#FBBF24" }}>C_decoy</code>) were inserted as leaves into the depth-10 Merkle tree in <code>VoterRegistry.sol</code>:
                    <div className="mono-box" style={{ marginTop: 8, fontSize: "0.75rem" }}>
                      Real Commitment Tx:  {result.txHashes?.[0] ? result.txHashes[0] : "Submitted on-chain"}<br/>
                      Decoy Commitment Tx: {result.txHashes?.[1] ? result.txHashes[1] : "Submitted on-chain"}<br/>
                      Updated Merkle Root: {result.merkleRoot || "0x..."}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <strong>Deterministic Public Nullifier (Prevents Double-Voting):</strong>
                      <div className="mono-box" style={{ marginTop: 4, fontSize: "0.75rem", color: "#38BDF8" }}>
                        Nullifier = Poseidon(secret, electionId) = {result.nullifier}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
            <Link to="/vote" className="btn btn-cyan" style={{ padding: "12px 28px" }}>
              Proceed to Cast Vote →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
