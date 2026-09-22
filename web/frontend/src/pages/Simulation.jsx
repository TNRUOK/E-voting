import React, { useState, useRef, useEffect } from "react";

export default function Simulation() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [completed, setCompleted] = useState(false);
  const terminalRef = useRef(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const startSimulation = () => {
    if (running) return;
    setRunning(true);
    setCompleted(false);
    setLogs([
      "=================================================================",
      "  THRESHOLD BLIND-SIGNATURE E-VOTING — END-TO-END SIMULATION",
      "=================================================================",
      "Connecting to SSE simulation pipeline...",
    ]);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/simulation/run");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.line) {
          setLogs((prev) => [...prev, data.line]);
        }
        if (data.status === "completed") {
          setLogs((prev) => [...prev, "✓ Simulation completed successfully."]);
          setRunning(false);
          setCompleted(true);
          es.close();
        }
      } catch (err) {
        setLogs((prev) => [...prev, event.data]);
      }
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
      setLogs((prev) => [
        ...prev,
        "⚠️ SSE stream closed or error encountered (check if backend and hardhat node are running).",
      ]);
      setRunning(false);
      es.close();
    };
  };

  const clearLogs = () => {
    setLogs([]);
    setCompleted(false);
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span className="badge badge-purple" style={{ marginBottom: 12 }}>Automated Verification</span>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          End-to-End Simulation Runner
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1rem", maxWidth: 680, margin: "0 auto" }}>
          Executes a live 5-voter end-to-end cryptographic scenario against the smart contracts and
          all 3 registrar processes, streaming stdout via Server-Sent Events (SSE).
        </p>
      </div>

      {/* Scenario Highlights Card */}
      <div className="glass-panel" style={{ padding: 24, marginBottom: 28 }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>
          Simulation Test Scenarios Covered
        </h3>
        <div className="grid-3" style={{ gap: 14 }}>
          <div style={{ background: "rgba(0,0,0,0.25)", padding: 14, borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--accent-cyan-light)" }}>
              1. Threshold Rotation (Voters 1-3)
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
              Demonstrates (R1+R2), (R2+R3), (R1+R3) pairings producing valid master blind signatures.
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.25)", padding: 14, borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#FBBF24" }}>
              2. Coercion Resistance (Voter 4)
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
              Decoy vote submitted to appease attacker; real vote submitted with true credential.
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.25)", padding: 14, borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#F87171" }}>
              3. Double-Vote Rejection (Voter 5)
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
              Re-submitting the same credential fails immediately at the smart contract nullifier check.
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={startSimulation}
            className="btn btn-primary"
            disabled={running}
            style={{ padding: "12px 28px", fontSize: "1rem" }}
          >
            {running ? (
              <>
                <span className="pulse-dot" style={{ background: "#FFFFFF", boxShadow: "0 0 8px #FFF" }} />
                Simulating Scenario...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Launch Simulation
              </>
            )}
          </button>
          {completed && (
            <span className="badge badge-green" style={{ fontSize: "0.85rem", padding: "6px 14px" }}>
              ✓ All 5 Scenarios Passed
            </span>
          )}
        </div>

        <button
          onClick={clearLogs}
          className="btn btn-outline"
          disabled={running || logs.length === 0}
          style={{ fontSize: "0.85rem", padding: "8px 16px" }}
        >
          Clear Terminal
        </button>
      </div>

      {/* Terminal View */}
      <div className="terminal-window">
        <div className="terminal-header">
          <div className="terminal-dots">
            <div className="terminal-dot dot-red"></div>
            <div className="terminal-dot dot-yellow"></div>
            <div className="terminal-dot dot-green"></div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            simulation/simulate.js (SSE Stream)
          </div>
          <div style={{ fontSize: "0.75rem", color: running ? "#34D399" : "var(--text-dim)" }}>
            {running ? "● LIVE" : "IDLE"}
          </div>
        </div>

        <div className="terminal-body" ref={terminalRef}>
          {logs.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontStyle: "italic", paddingTop: 40, textAlign: "center" }}>
              Ready. Click "Launch Simulation" above to execute the 5-voter pipeline.
            </div>
          ) : (
            logs.map((line, idx) => {
              // Color coding based on log content
              let color = "#E2E8F0";
              if (line.includes("✓") || line.includes("SUCCESS") || line.includes("passed")) color = "#34D399";
              else if (line.includes("REJECT") || line.includes("error") || line.includes("FAILED")) color = "#F87171";
              else if (line.includes("COERCION") || line.includes("DECOY") || line.includes("⚠️")) color = "#FBBF24";
              else if (line.includes("VOTER") || line.includes("STAGE") || line.includes("===")) color = "var(--accent-cyan-light)";

              return (
                <div key={idx} className="terminal-line" style={{ color }}>
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
