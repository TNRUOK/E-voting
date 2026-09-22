import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all" | "real" | "decoy"
  const [activeTab, setActiveTab] = useState("votes"); // "votes" | "merkle" | "registrars"
  const [errorMsg, setErrorMsg] = useState("");

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/audit");
      if (!res.ok) throw new Error("Failed to fetch admin audit logs");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to load audit data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
    const interval = setInterval(fetchAuditData, 4000);
    return () => clearInterval(interval);
  }, []);

  const clearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear the audit logs?")) return;
    try {
      await fetch("/api/admin/clear-audit", { method: "POST" });
      fetchAuditData();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredVotes = (data?.auditVotes || []).filter((v) => {
    if (filter === "real") return v.type === "real";
    if (filter === "decoy") return v.type === "decoy";
    return true;
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="badge badge-purple" style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
              👑 Administrator Portal
            </span>
            <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>
              Live Audit & Decoy Inspector
            </span>
          </div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            E-Voting Cryptographic Audit Console
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: 0 }}>
            Complete transparency into real vs decoy ballots, on-chain Merkle commitments, and threshold key shards.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={fetchAuditData} className="btn btn-outline" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
            🔄 Refresh
          </button>
          <button onClick={clearLogs} className="btn btn-outline" style={{ padding: "8px 16px", fontSize: "0.85rem", color: "#F87171", borderColor: "rgba(239,68,68,0.3)" }}>
            🗑️ Reset Logs
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid-4" style={{ gap: 16, marginBottom: 28 }}>
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Total Ballots Cast
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-main)", marginTop: 4 }}>
            {data?.stats?.totalVotesCast ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>
            Across all browser sessions
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 20, borderLeft: "3px solid #10B981" }}>
          <div style={{ fontSize: "0.75rem", color: "#34D399", textTransform: "uppercase", fontWeight: 600 }}>
            ✓ Real Ballots (Counted)
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#34D399", marginTop: 4 }}>
            {data?.stats?.totalRealVotes ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>
            Official election choices
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 20, borderLeft: "3px solid #F59E0B" }}>
          <div style={{ fontSize: "0.75rem", color: "#FBBF24", textTransform: "uppercase", fontWeight: 600 }}>
            ⚠️ Decoy Ballots (Defense)
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#FBBF24", marginTop: 4 }}>
            {data?.stats?.totalDecoyVotes ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>
            Coercion defense submissions
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 20, borderLeft: "3px solid var(--accent-cyan)" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--accent-cyan-light)", textTransform: "uppercase", fontWeight: 600 }}>
            Merkle Tree Leaves
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent-cyan-light)", marginTop: 4 }}>
            {data?.stats?.totalMerkleLeaves ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>
            {data?.stats?.totalRealLeaves ?? 0} Real + {data?.stats?.totalDecoyLeaves ?? 0} Decoy
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab("votes")}
          className={`btn ${activeTab === "votes" ? "btn-primary" : "btn-outline"}`}
          style={{ padding: "8px 20px" }}
        >
          🗳️ Cast Ballots Audit ({data?.auditVotes?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("merkle")}
          className={`btn ${activeTab === "merkle" ? "btn-primary" : "btn-outline"}`}
          style={{ padding: "8px 20px" }}
        >
          🌳 Merkle Tree Commitments ({data?.taggedLeaves?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("registrars")}
          className={`btn ${activeTab === "registrars" ? "btn-primary" : "btn-outline"}`}
          style={{ padding: "8px 20px" }}
        >
          🛡️ 2-of-3 Threshold Shards
        </button>
      </div>

      {/* TAB 1: Cast Votes Audit */}
      {activeTab === "votes" && (
        <div>
          {/* Filter Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setFilter("all")}
                className={`btn ${filter === "all" ? "btn-cyan" : "btn-outline"}`}
                style={{ padding: "6px 14px", fontSize: "0.8rem" }}
              >
                All Ballots ({data?.auditVotes?.length || 0})
              </button>
              <button
                onClick={() => setFilter("real")}
                className={`btn ${filter === "real" ? "btn-primary" : "btn-outline"}`}
                style={{ padding: "6px 14px", fontSize: "0.8rem", color: filter === "real" ? "#fff" : "#34D399" }}
              >
                ✓ Real Only ({data?.stats?.totalRealVotes || 0})
              </button>
              <button
                onClick={() => setFilter("decoy")}
                className={`btn ${filter === "decoy" ? "btn-cyan" : "btn-outline"}`}
                style={{ padding: "6px 14px", fontSize: "0.8rem", color: filter === "decoy" ? "#fff" : "#FBBF24" }}
              >
                ⚠️ Decoys Only ({data?.stats?.totalDecoyVotes || 0})
              </button>
            </div>
          </div>

          {filteredVotes.length === 0 ? (
            <div className="glass-panel" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "1.1rem", marginBottom: 8 }}>No votes recorded yet in this audit session.</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                Go to <Link to="/register" style={{ color: "var(--accent-cyan-light)" }}>Registration</Link> and then <Link to="/vote" style={{ color: "var(--accent-cyan-light)" }}>Cast Ballot</Link> to generate real and decoy votes.
              </p>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "rgba(15, 23, 42, 0.9)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                    <th style={{ padding: "14px 18px" }}>Type</th>
                    <th style={{ padding: "14px 18px" }}>Voter / ID</th>
                    <th style={{ padding: "14px 18px" }}>Candidate Selected</th>
                    <th style={{ padding: "14px 18px" }}>Nullifier Hash</th>
                    <th style={{ padding: "14px 18px" }}>Tx Hash</th>
                    <th style={{ padding: "14px 18px" }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVotes.map((v, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: v.type === "decoy" ? "rgba(245, 158, 11, 0.03)" : "transparent" }}>
                      <td style={{ padding: "14px 18px" }}>
                        {v.type === "real" ? (
                          <span className="badge badge-green" style={{ fontSize: "0.72rem", padding: "3px 8px" }}>
                            ✓ Real Vote
                          </span>
                        ) : (
                          <span className="badge badge-yellow" style={{ fontSize: "0.72rem", padding: "3px 8px", background: "rgba(245, 158, 11, 0.2)", color: "#FBBF24", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                            ⚠️ Decoy (Coercion)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", fontWeight: 600, color: "var(--text-main)" }}>
                        {v.voterName}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{ fontWeight: 700, color: "var(--accent-cyan-light)" }}>{v.candidate}</span>
                      </td>
                      <td style={{ padding: "14px 18px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "#38BDF8" }}>
                        {v.nullifier?.slice(0, 14)}...{v.nullifier?.slice(-8)}
                      </td>
                      <td style={{ padding: "14px 18px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {v.txHash?.slice(0, 12)}...
                      </td>
                      <td style={{ padding: "14px 18px", color: "var(--text-dim)", fontSize: "0.78rem" }}>
                        {new Date(v.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Merkle Tree Leaves Inspector */}
      {activeTab === "merkle" && (
        <div>
          <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              Current On-Chain Merkle Root (VoterRegistry.sol)
            </div>
            <div className="mono-box" style={{ fontSize: "0.85rem", color: "var(--accent-cyan-light)" }}>
              {data?.stats?.merkleRoot || "0x..."}
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", margin: "10px 0 0 0" }}>
              Every registration inserts two leaves (one Real commitment and one Decoy commitment). The zk-SNARK circuit proves membership in this tree without disclosing the leaf index.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.9)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 18px" }}>Leaf Index</th>
                  <th style={{ padding: "14px 18px" }}>Classification</th>
                  <th style={{ padding: "14px 18px" }}>Commitment Hash (Poseidon)</th>
                  <th style={{ padding: "14px 18px" }}>Associated Voter</th>
                  <th style={{ padding: "14px 18px" }}>Registrars Used</th>
                </tr>
              </thead>
              <tbody>
                {(data?.taggedLeaves || []).map((leaf) => (
                  <tr key={leaf.index} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "var(--accent-violet-light)" }}>
                      #{leaf.index}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {leaf.type === "real" ? (
                        <span className="badge badge-green" style={{ fontSize: "0.72rem" }}>Real Leaf</span>
                      ) : leaf.type === "decoy" ? (
                        <span className="badge badge-yellow" style={{ fontSize: "0.72rem", background: "rgba(245, 158, 11, 0.2)", color: "#FBBF24" }}>Decoy Leaf</span>
                      ) : (
                        <span className="badge badge-purple" style={{ fontSize: "0.72rem" }}>Pre-seeded Leaf</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 18px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--accent-cyan-light)" }}>
                      {leaf.commitment}
                    </td>
                    <td style={{ padding: "14px 18px", color: "var(--text-main)" }}>
                      {leaf.voterName}
                    </td>
                    <td style={{ padding: "14px 18px", color: "var(--text-dim)", fontSize: "0.78rem" }}>
                      {leaf.registrarsUsed?.length > 0 ? leaf.registrarsUsed.map(r => `R${r}`).join(", ") : "R1, R2"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: 2-of-3 Threshold Shards */}
      {activeTab === "registrars" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 12 }}>
              Threshold Cryptography Configuration
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              The system distributes the RSA private signing key <code>d</code> across 3 independent registrar servers using a (t=2, n=3) Shamir Secret Sharing scheme:
              <br />
              <span className="mono-box" style={{ display: "inline-block", margin: "8px 0", padding: "6px 14px", color: "var(--accent-cyan-light)" }}>
                P(x) = d + a₁·x (mod φ(N))
              </span>
              <br />
              Each registrar <code>i</code> holds private share <code>d_i = P(i)</code>. Any 2 registrars can jointly sign a blinded voter commitment without ever reconstructing or leaking the master key <code>d</code>.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Threshold Scheme</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-cyan-light)", marginTop: 4 }}>2-of-3 Blind RSA</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Public Exponent (e)</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#34D399", marginTop: 4 }}>{data?.publicKey?.e || "65537"}</div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
                Shared RSA Modulus N (2048-bit hex)
              </div>
              <div className="mono-box" style={{ fontSize: "0.75rem", wordBreak: "break-all", maxHeight: 120, overflowY: "auto" }}>
                {data?.publicKey?.N || "0x..."}
              </div>
            </div>
          </div>

          {/* Registrars Status Cards */}
          <div className="grid-3" style={{ gap: 16 }}>
            {[1, 2, 3].map((regId) => (
              <div key={regId} className="glass-panel" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Registrar #{regId}</span>
                  <span className="badge badge-green" style={{ fontSize: "0.72rem" }}>Online :300{regId}</span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 8 }}>
                  Holds Shamir Share $d_{regId} = P({regId})$
                </div>
                <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>Partial Signatures Issued: </span>
                  <strong style={{ color: "var(--accent-cyan-light)" }}>{data?.registrarCounters?.[regId] || 0}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
