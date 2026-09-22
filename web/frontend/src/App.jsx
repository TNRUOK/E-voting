import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Vote from "./pages/Vote";
import Dashboard from "./pages/Dashboard";
import Simulation from "./pages/Simulation";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public route — login/signup, no Navbar */}
        <Route path="/login" element={<Login />} />

        {/* All other routes are protected and share the Navbar + layout */}
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="app-container">
              <Navbar />
              <main className="main-content">
                <Routes>
                  <Route path="/"           element={<Landing />} />
                  <Route path="/register"   element={<Register />} />
                  <Route path="/vote"       element={<Vote />} />
                  <Route path="/dashboard"  element={<Dashboard />} />
                  <Route path="/simulation" element={<Simulation />} />
                  <Route path="/admin"      element={<Admin />} />
                </Routes>
              </main>
              <footer style={{
                borderTop: "1px solid var(--border-subtle)",
                padding: "24px",
                textAlign: "center",
                fontSize: "0.82rem",
                color: "var(--text-dim)",
                background: "rgba(10, 15, 30, 0.6)"
              }}>
                <div>
                  Threshold Blind-Signature Credential Issuance for Anonymous E-Voting • Extension of Tang et al. (2023)
                </div>
                <div style={{ marginTop: 4 }}>
                  Distributed (2,3)-Threshold RSA (Shoup 2000) • Poseidon Merkle Tree • Groth16 zk-SNARK
                </div>
              </footer>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}
