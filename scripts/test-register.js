// scripts/test-register.js — quick integration test for voter registration
"use strict";
const http = require("http");

const body = JSON.stringify({ voterName: "IntegrationTest" });
const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/voters/register",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

console.log("POST /api/voters/register ...");
const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      if (json.success) {
        console.log("\n✅ REGISTRATION SUCCEEDED!\n");
        console.log("  Real commitment:   ", json.real.commitment.slice(0, 26) + "...");
        console.log("  Decoy commitment:  ", json.decoy.commitment.slice(0, 26) + "...");
        console.log("  Nullifier:         ", json.nullifier.slice(0, 26) + "...");
        console.log("  Registrars used:   ", json.registrarsUsed);
        console.log("  Registrar skipped: ", json.registrarSkipped);
        console.log("  TX hashes:         ", json.txHashes.map(h => h.slice(0, 18) + "...").join(", "));
        console.log("\n  Steps:");
        (json.steps || []).forEach(s => console.log("   ", s));
      } else {
        console.log("\n❌ REGISTRATION FAILED:", json.error);
      }
    } catch (e) {
      console.log("Raw response:", data);
    }
  });
});
req.on("error", (e) => {
  console.error("Request error:", e.message);
});
req.write(body);
req.end();
