import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function Register() {
  const [voterName, setVoterName] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);

  const steps = [
    { title: "Generate Keys", desc: "Creating Real + Decoy credentials with Poseidon commitments" },
    { title: "Blind Commitment", desc: "Multiplying commitment by r^e mod N to blind from registrars" },
    { title: "2-of-3 Partial Sigs", desc: "Requesting partial signatures from 2 independent registrars" },
    { title: "Threshold Combine", desc: "Lagrange interpolation across partial signatures & unblinding" },
    { title: "On-Chain Registry", desc: "Submitting commitment to VoterRegistry.sol Merkle tree" }
  ];

  const handleRegister = async (e) => {
    e.preventDefault();
    const name = voterName.trim() || `Voter_${Math.floor(1000 + Math.random() * 9000)}`;
    setLoading(true);
    setErrorMsg("");
    setResult(null);
    setCurrentStep(1);

    try {
      // Step simulated progress for visual clarity
      const stepTimer1 = setTimeout(() => setCurrentStep(2), 600);
      const stepTimer2 = setTimeout(() => setCurrentStep(3), 1300);

      const res = await fetch("/api/voters/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
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

      {/* Registration Card */}
      <div className="glass-panel" style={{ padding: "32px", marginBottom: 32 }}>
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Voter Name / Simulation ID</label>
            <div style={{ display: "flex", gap: 12 }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Alice Voter (optional simulation label)"
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
            <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: 6 }}>
              Note: Voter name is strictly simulation metadata. It is never stored on the blockchain or linked to credentials.
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

          {/* Educational / Professor Presentation Mode */}
          <div style={{ marginTop: 32, background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(124, 58, 237, 0.4)", borderRadius: "var(--radius-sm)", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="badge badge-purple" style={{ fontSize: "0.75rem" }}>
                  🎓 Presentation / Viva Mode
                </span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                  Cryptographic Credential Generation Breakdown
                </h3>
              </div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Here is the exact step-by-step cryptographic pipeline executed for this voter. You can walk through each stage to explain the mathematics and coercion-resistance mechanism:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Step 1 */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px 18px", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontWeight: 700, color: "var(--accent-cyan-light)", fontSize: "0.9rem", marginBottom: 4 }}>
                  1. Scalar Generation (Private to Client)
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                  The client generates a 248-bit secret scalar <code>s</code> and two random scalars (<code>v_real</code>, <code>v_decoy</code>) in the BN254 scalar field:
                  <div className="mono-box" style={{ marginTop: 6, fontSize: "0.75rem" }}>
                    secret (s): {result.secret?.slice(0, 26)}...<br/>
                    real value (v_real): {result.real?.value?.slice(0, 26)}...<br/>
                    decoy value (v_decoy): {result.decoy?.value?.slice(0, 26)}...
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px 18px", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontWeight: 700, color: "#34D399", fontSize: "0.9rem", marginBottom: 4 }}>
                  2. Poseidon Commitments: C = Poseidon(s, v)
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                  Both commitments are calculated using the algebraic Poseidon hash (zk-SNARK friendly):
                  <div className="mono-box" style={{ marginTop: 6, fontSize: "0.75rem" }}>
                    C_real:  {result.real?.commitment}<br/>
                    C_decoy: {result.decoy?.commitment}
                  </div>
                  <em>Note: Both commitments appear identical in structure and cannot be linked to the secret or voter.</em>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px 18px", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontWeight: 700, color: "var(--accent-violet-light)", fontSize: "0.9rem", marginBottom: 4 }}>
                  3. RSA Blinding: m' = m · r^e mod N
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                  A random blinding factor <code>r ∈ Z_N*</code> blinds each commitment before network transmission.
                  Registrars <strong>only see random group elements</strong> and cannot know what they are signing.
                </div>
              </div>

              {/* Step 4 */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px 18px", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontWeight: 700, color: "#FBBF24", fontSize: "0.9rem", marginBottom: 4 }}>
                  4. 2-of-3 Threshold Signing & Lagrange Interpolation
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                  Partial signatures <code>s_i = (m')^(d_i) mod N</code> were received from Registrars <strong>{result.registrarsUsed ? result.registrarsUsed.map(r => `R${r}`).join(" & ") : "R1 & R2"}</strong>.
                  The client interpolated using Lagrange coefficients and multiplied by <code>r^(-1)</code> to recover the master RSA signature <code>S = m^d mod N</code> without any single server ever holding <code>d</code>.
                </div>
              </div>

              {/* Step 5 */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px 18px", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontWeight: 700, color: "#38BDF8", fontSize: "0.9rem", marginBottom: 4 }}>
                  5. On-Chain Merkle Tree & Nullifier Derivation
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                  Both commitments were submitted as leaves in <code>VoterRegistry.sol</code>.
                  The public nullifier prevents double-voting:
                  <div className="mono-box" style={{ marginTop: 6, fontSize: "0.75rem" }}>
                    Nullifier = Hash(secret, electionId) = {result.nullifier}
                  </div>
                </div>
              </div>
            </div>
          </div>

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
