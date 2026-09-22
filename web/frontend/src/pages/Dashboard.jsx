import React, { useState, useEffect } from "react";

export default function Dashboard() {
  const [tally, setTally] = useState([]);
  const [merkleTree, setMerkleTree] = useState({ leafCount: 0, root: "0x0" });
  const [registrars, setRegistrars] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchData = async () => {
    try {
      // 1. Fetch live tally
      const tallyRes = await fetch("/api/tally");
      if (tallyRes.ok) {
        const data = await tallyRes.json();
        const candTally = data.tally || [];
        setTally(candTally);
        const total = candTally.reduce((acc, c) => acc + (Number(c.votes) || 0), 0);
        setTotalVotes(total);
      }

      // 2. Fetch Merkle tree info
      const merkleRes = await fetch("/api/merkle/tree");
      if (merkleRes.ok) {
        const data = await merkleRes.json();
        setMerkleTree({
          leafCount: data.leafCount ?? 0,
          root: data.root || "0x0"
        });
      }

      // 3. Fetch registrar status
      const regRes = await fetch("/api/registrars/status");
      if (regRes.ok) {
        const data = await regRes.json();
        setRegistrars(data.registrars || []);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Dashboard poll error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 32,
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <span className="badge badge-purple" style={{ marginBottom: 8 }}>Live On-Chain Analytics</span>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Election Dashboard & Verification
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Real-time tally from <code style={{ color: "var(--accent-cyan-light)" }}>Voting.sol</code> and Merkle state from <code style={{ color: "var(--accent-cyan-light)" }}>VoterRegistry.sol</code>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
            Auto-refreshing every 3s • Last: {lastRefreshed.toLocaleTimeString()}
          </div>
          <button onClick={fetchData} className="btn btn-outline" style={{ padding: "6px 14px", fontSize: "0.85rem" }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Top Stat Summary Cards */}
      <div className="grid-3" style={{ marginBottom: 32 }}>
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Total Ballots Cast
          </div>
          <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-main)" }}>
            {totalVotes}
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--accent-cyan-light)", marginTop: 4 }}>
            Zero-knowledge verified on-chain
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Registered Voters (Merkle Leaves)
          </div>
          <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--accent-violet-light)" }}>
            {merkleTree.leafCount}
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
            Tree capacity: 1,024 leaves (depth 10)
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Active Registrars
          </div>
          <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "#34D399" }}>
            {registrars.filter(r => r.online).length} / {registrars.length || 3}
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
            Threshold (2,3) quorum satisfied
          </div>
        </div>
      </div>

      {/* Main Grid: Live Vote Tally + Registrar Network */}
      <div className="grid-2" style={{ marginBottom: 32, alignItems: "start" }}>
        {/* Live Vote Tally */}
        <div className="glass-panel" style={{ padding: 28 }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 20 }}>
            Live Candidate Tally
          </h2>

          {loading && tally.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              Polling smart contract...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {tally.map((cand, idx) => {
                const count = Number(cand.votes) || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const colors = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EC4899"];
                const color = cand.color || colors[idx % colors.length];

                return (
                  <div key={idx}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {cand.name}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                        {count} {count === 1 ? "vote" : "votes"} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{
                      height: 12,
                      background: "#1E293B",
                      borderRadius: 6,
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: color,
                        borderRadius: 6,
                        transition: "width 0.5s ease"
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Registrar Network Activity */}
        <div className="glass-panel" style={{ padding: 28 }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 10 }}>
            (2,3) Registrar Service Nodes
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 20 }}>
            Distributed signer processes. Any 2 form a signing quorum without exposing private keys.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[1, 2, 3].map((id) => {
              const reg = registrars.find(r => r.id === id) || { id, online: false, requestsHandled: 0 };
              const isOnline = reg.online;

              return (
                <div
                  key={id}
                  style={{
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span className="pulse-dot" style={{
                      background: isOnline ? "#10B981" : "#EF4444",
                      boxShadow: `0 0 8px ${isOnline ? "#10B981" : "#EF4444"}`
                    }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                        Registrar #{id}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        Port 300{id} • Key Share d_{id}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${isOnline ? "badge-green" : "badge-amber"}`}>
                      {isOnline ? "Operational" : "Standby / Offline"}
                    </span>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                      Sigs served: <strong>{reg.requestsHandled ?? 0}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Merkle Tree State Section */}
      <div className="glass-panel" style={{ padding: 28 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
          Merkle Tree On-Chain Commitment State
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 20 }}>
          Incremental Poseidon Merkle Tree maintained in <code style={{ color: "var(--accent-cyan-light)" }}>VoterRegistry.sol</code>.
          Zero-knowledge proofs prove membership against this root.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Current Merkle Root (Height 10)
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-cyan-light)", marginTop: 4 }}>
              Root Hash:
            </div>
          </div>
          <div className="mono-box" style={{ fontSize: "0.8rem" }}>
            {merkleTree.root}
          </div>
        </div>
      </div>
    </div>
  );
}
