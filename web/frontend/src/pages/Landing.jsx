import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ name: "", tagline: "", color: "#7C3AED" });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/candidates");
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
      }
    } catch (err) {
      console.error("Failed to load candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!newCandidate.name.trim()) return;
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCandidate),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Candidate "${newCandidate.name}" successfully added!`);
        setNewCandidate({ name: "", tagline: "", color: "#7C3AED" });
        setShowAddModal(false);
        await loadCandidates();
      } else {
        setErrorMsg(data.error || "Failed to add candidate");
      }
    } catch (err) {
      setErrorMsg(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section style={{
        textAlign: "center",
        padding: "48px 0 40px",
        maxWidth: 880,
        margin: "0 auto"
      }}>
        <div style={{ display: "inline-flex", marginBottom: 16 }}>
          <span className="badge badge-purple">
            Tang et al. (2023) Extension • (2,3)-Threshold Blind RSA
          </span>
        </div>
        <h1 style={{
          fontSize: "clamp(2rem, 5vw, 3.2rem)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          marginBottom: 20
        }}>
          Anonymous & Coercion-Resistant <br />
          <span style={{
            background: "linear-gradient(135deg, #A78BFA 0%, #06B6D4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Smart Contract E-Voting
          </span>
        </h1>
        <p style={{
          fontSize: "1.1rem",
          color: "var(--text-muted)",
          lineHeight: 1.6,
          marginBottom: 32
        }}>
          Eliminates the single trusted registrar vulnerability. Voter credentials are
          issued via distributed 2-of-3 RSA blind signatures, proven anonymously on-chain with
          Groth16 zk-SNARKs, and secured against coercion with dual-credential nullifiers.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/register" className="btn btn-primary" style={{ padding: "14px 28px", fontSize: "1rem" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            Register as a Voter
          </Link>
          <Link to="/vote" className="btn btn-cyan" style={{ padding: "14px 28px", fontSize: "1rem" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            Cast Anonymized Ballot
          </Link>
          <Link to="/simulation" className="btn btn-outline" style={{ padding: "14px 24px" }}>
            Run Full 5-Voter Simulation
          </Link>
        </div>
      </section>

      {/* Candidates Section */}
      <section style={{ margin: "48px 0" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16
        }}>
          <div>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Election Candidates
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
              Review the official candidates participating in this cryptographic election.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-outline"
            style={{ fontSize: "0.88rem", padding: "8px 16px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Candidate
          </button>
        </div>

        {successMsg && (
          <div style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            color: "#34D399",
            padding: "12px 18px",
            borderRadius: "var(--radius-sm)",
            marginBottom: 20
          }}>
            {successMsg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            Loading candidate slate...
          </div>
        ) : (
          <div className="grid-3">
            {candidates.map((cand, idx) => (
              <div
                key={cand.id || idx}
                className="glass-panel"
                style={{
                  padding: "24px",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: cand.color || "var(--accent-violet)"
                }} />
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{
                      width: 50,
                      height: 50,
                      borderRadius: 14,
                      background: `linear-gradient(135deg, ${cand.color || "#7C3AED"} 0%, #1E293B 100%)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.4rem",
                      fontWeight: 800,
                      color: "#FFFFFF"
                    }}>
                      {cand.name.charAt(0)}
                    </div>
                    <span className="badge badge-purple" style={{ fontSize: "0.75rem" }}>
                      ID #{cand.id}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 6 }}>
                    {cand.name}
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", minHeight: 48, marginBottom: 20 }}>
                    "{cand.tagline || "Committed to privacy and community integrity"}"
                  </p>
                </div>

                <Link
                  to={`/vote?candidate=${cand.id}`}
                  className="btn btn-outline"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Vote for {cand.name}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 20
        }}>
          <div className="glass-panel" style={{ maxWidth: 480, width: "100%", padding: 32, position: "relative" }}>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
              Add Election Candidate
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: 24 }}>
              Register a new candidate in <code style={{ color: "var(--accent-cyan-light)" }}>config/candidates.json</code>.
            </p>

            {errorMsg && (
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#FCA5A5",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                marginBottom: 16,
                fontSize: "0.88rem"
              }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddCandidate}>
              <div className="form-group">
                <label className="form-label">Candidate Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. David Vance"
                  value={newCandidate.name}
                  onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Platform Tagline</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Decentralization and Privacy for All"
                  value={newCandidate.tagline}
                  onChange={(e) => setNewCandidate({ ...newCandidate, tagline: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Brand Color</label>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input
                    type="color"
                    value={newCandidate.color}
                    onChange={(e) => setNewCandidate({ ...newCandidate, color: e.target.value })}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      border: "1px solid var(--border-subtle)",
                      background: "transparent",
                      cursor: "pointer"
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem", color: "var(--text-muted)" }}>
                    {newCandidate.color}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 28 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Adding..." : "Add Candidate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Protocol Architecture Features */}
      <section style={{ margin: "64px 0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span className="badge badge-cyan" style={{ marginBottom: 12 }}>Under The Hood</span>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            How The Extended Security Model Works
          </h2>
        </div>

        <div className="grid-3">
          <div className="glass-panel" style={{ padding: "28px" }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(124, 58, 237, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet-light)" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 10 }}>
              (2,3) Threshold Blind Signature
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Key share <code style={{ color: "var(--accent-cyan-light)" }}>d_i</code> is held by 3 independent registrars.
              Voter blinds their credential commitment and contacts any 2 registrars. Partial signatures are combined via
              Lagrange interpolation without ever reconstructing the private key.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: "28px" }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(6, 182, 212, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan-light)" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 10 }}>
              Groth16 zk-SNARK Anonymity
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Voters prove membership in the on-chain Merkle tree of registered commitments using Poseidon hashing.
              The smart contract verifies the proof without knowing the voter's identity, leaf index, or secret.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: "28px" }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(16, 185, 129, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 10 }}>
              Real + Decoy Coercion Resistance
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Both real and decoy credentials pass on-chain verification identically. A coerced voter can submit their
              decoy credential to satisfy an attacker, while their true vote is safely cast with the real credential.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
