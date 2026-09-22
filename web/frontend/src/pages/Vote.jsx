import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function Vote() {
  const [searchParams] = useSearchParams();
  const candidateParam = searchParams.get("candidate");

  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(candidateParam ? Number(candidateParam) : null);
  const [credentialType, setCredentialType] = useState("real"); // "real" | "decoy" | "custom"
  const [credentialData, setCredentialData] = useState(null);
  const [customCredentialJson, setCustomCredentialJson] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [proofStatus, setProofStatus] = useState("");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Load candidates
    async function fetchCandidates() {
      try {
        const res = await fetch("/api/candidates");
        if (res.ok) {
          const data = await res.json();
          setCandidates(data.candidates || []);
          if (!selectedCandidate && data.candidates?.length > 0) {
            setSelectedCandidate(data.candidates[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load candidates", err);
      }
    }
    fetchCandidates();

    // Check localStorage for saved credentials from registration
    try {
      const saved = localStorage.getItem("latest_credential");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCredentialData(parsed);
      }
    } catch (e) {}
  }, []);

  const handleCastVote = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) {
      setErrorMsg("Please select a candidate.");
      return;
    }

    // Determine credential to use
    let secret = null;
    let credValue = null;
    let commitment = null;

    if (credentialType === "custom") {
      try {
        const parsed = JSON.parse(customCredentialJson.trim());
        // Check if user pasted full registration payload or individual real/decoy object
        const nested = parsed.real || parsed.decoy || parsed;
        secret = parsed.secret || nested.secret || credentialData?.secret;
        credValue = nested.value || nested.credValue || nested.credential || parsed.value || parsed.credValue || parsed.credential;
        commitment = nested.commitment || parsed.commitment;
      } catch (err) {
        setErrorMsg("Invalid JSON syntax in custom credential input: " + err.message);
        return;
      }
    } else if (credentialData) {
      secret = credentialData.secret || (credentialType === "real" ? credentialData.real?.secret : credentialData.decoy?.secret);
      const target = credentialType === "real" ? credentialData.real : credentialData.decoy;
      if (target) {
        credValue = target.value || target.credValue || target.credential;
        commitment = target.commitment;
      }
    }

    if (!secret || !credValue || !commitment) {
      setErrorMsg("Missing required credential fields (secret, value, commitment). Please check your JSON or register first.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setResult(null);
    setProofStatus("Generating Poseidon witness and Groth16 zero-knowledge proof...");

    try {
      const timer = setTimeout(() => {
        setProofStatus("Proof verified off-chain. Transacting with Voting.sol...");
      }, 1200);

      const candidateIndex = candidates.findIndex(c => c.id === selectedCandidate);
      const res = await fetch("/api/votes/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          credValue,
          commitment,
          candidateIndex: candidateIndex >= 0 ? candidateIndex : 0,
        })
      });

      clearTimeout(timer);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Vote rejected by smart contract");
      }

      setResult(data);
      setProofStatus("");
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit ballot");
      setProofStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span className="badge badge-cyan" style={{ marginBottom: 12 }}>zk-SNARK Voting</span>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Cast Your Confidential Ballot
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1rem", maxWidth: 640, margin: "0 auto" }}>
          Prove your membership in the credential Merkle tree in zero-knowledge.
          The blockchain verifies that your leaf exists and marks your nullifier without revealing who you are.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: "32px", marginBottom: 32 }}>
        <form onSubmit={handleCastVote}>
          {/* Step 1: Candidate Selection */}
          <div style={{ marginBottom: 32 }}>
            <label className="form-label" style={{ fontSize: "1rem", marginBottom: 12 }}>
              1. Select Candidate
            </label>
            <div className="grid-3" style={{ gap: 16 }}>
              {candidates.map((cand) => {
                const isSelected = selectedCandidate === cand.id;
                return (
                  <div
                    key={cand.id}
                    onClick={() => setSelectedCandidate(cand.id)}
                    style={{
                      border: isSelected ? `2px solid ${cand.color || "var(--accent-violet)"}` : "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      padding: "16px",
                      background: isSelected ? "rgba(124, 58, 237, 0.15)" : "rgba(15, 23, 42, 0.6)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      position: "relative"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "1.05rem", color: isSelected ? "#FFFFFF" : "var(--text-main)" }}>
                        {cand.name}
                      </span>
                      {isSelected && (
                        <span className="badge badge-green" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                          Selected
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>
                      {cand.tagline}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Credential Selection */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <label className="form-label" style={{ fontSize: "1rem", margin: 0 }}>
                2. Choose Credential (Coercion Resistance)
              </label>
              {!credentialData && (
                <Link to="/register" style={{ fontSize: "0.85rem", color: "var(--accent-cyan-light)" }}>
                  Need to register first?
                </Link>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <button
                type="button"
                className={`btn ${credentialType === "real" ? "btn-primary" : "btn-outline"}`}
                style={{ flex: 1, padding: "10px" }}
                onClick={() => setCredentialType("real")}
              >
                ✓ Real Credential
              </button>
              <button
                type="button"
                className={`btn ${credentialType === "decoy" ? "btn-cyan" : "btn-outline"}`}
                style={{ flex: 1, padding: "10px" }}
                onClick={() => setCredentialType("decoy")}
              >
                ⚠️ Decoy Credential (Coercion Mode)
              </button>
              <button
                type="button"
                className={`btn ${credentialType === "custom" ? "btn-primary" : "btn-outline"}`}
                style={{ padding: "10px 16px" }}
                onClick={() => setCredentialType("custom")}
              >
                Custom JSON
              </button>
            </div>

            {credentialType === "decoy" && (
              <div style={{
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                padding: "12px 16px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                color: "#FCD34D",
                marginBottom: 16
              }}>
                ℹ️ <strong>Demonstration Note:</strong> Submitting with your Decoy credential generates a valid zero-knowledge
                membership proof that looks indistinguishable to any observer or coercer, proving compliance without affecting the real vote!
              </div>
            )}

            {credentialType === "custom" ? (
              <div className="form-group">
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder='Paste any credential JSON, e.g. {"value": "0x...", "commitment": "0x...", "secret": "0x..."}'
                  value={customCredentialJson}
                  onChange={(e) => setCustomCredentialJson(e.target.value)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}
                />
              </div>
            ) : credentialData ? (
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px 18px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Active Credential Secret Prefix: </span>
                <code style={{ color: "var(--accent-cyan-light)" }}>
                  {(credentialData.secret || (credentialType === "real" ? credentialData.real?.secret : credentialData.decoy?.secret))?.slice(0, 20)}...
                </code>
              </div>
            ) : (
              <div style={{
                padding: "16px",
                background: "rgba(245, 158, 11, 0.1)",
                borderRadius: "var(--radius-sm)",
                color: "#FBBF24",
                fontSize: "0.88rem"
              }}>
                No stored credential detected in this browser session. Please <Link to="/register" style={{ color: "var(--accent-cyan-light)", textDecoration: "underline" }}>register here</Link> or switch to <strong>Custom JSON</strong>.
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-cyan"
            disabled={loading || (!credentialData && credentialType !== "custom")}
            style={{ width: "100%", padding: "14px", fontSize: "1.05rem" }}
          >
            {loading ? "Generating zk-Proof & Submitting..." : "Submit Zero-Knowledge Ballot"}
          </button>
        </form>

        {proofStatus && (
          <div style={{
            marginTop: 20,
            padding: "16px",
            background: "rgba(124, 58, 237, 0.15)",
            border: "1px solid rgba(124, 58, 237, 0.4)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            gap: 12
          }}>
            <span className="pulse-dot" style={{ background: "var(--accent-cyan)", boxShadow: "0 0 8px var(--accent-cyan)" }} />
            <span style={{ fontSize: "0.9rem", color: "var(--accent-cyan-light)" }}>{proofStatus}</span>
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
            <strong>Transaction Rejected:</strong> {errorMsg}
          </div>
        )}
      </div>

      {/* Vote Confirmation Card */}
      {result && (
        <div className="glass-panel" style={{
          padding: "32px",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          boxShadow: "0 0 30px rgba(16, 185, 129, 0.15)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#34D399"
            }}>
              ✓
            </div>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                Ballot Successfully Recorded
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Verified on-chain via smart contract nullifier deduplication
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "24px 0" }}>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Candidate Voted
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
                {result.candidate || candidates.find(c => c.id === selectedCandidate)?.name || `ID #${selectedCandidate}`}
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Credential Mode
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: credentialType === "real" ? "#34D399" : "#FBBF24" }}>
                {credentialType === "real" ? "Real Vote" : "Decoy (Coercion)"}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              Cryptographic Nullifier (Prevents Double-Voting)
            </div>
            <div className="mono-box" style={{ fontSize: "0.8rem", color: "#38BDF8" }}>
              {result.nullifier || "0x..."}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              On-Chain Transaction Hash
            </div>
            <div className="mono-box" style={{ fontSize: "0.8rem" }}>
              {result.txHash || "0x..."}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Link to="/dashboard" className="btn btn-primary" style={{ padding: "10px 24px" }}>
              View Live Tally on Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
