// scripts/test-register.js — integration test for authenticated voter registration
"use strict";
const http = require("http");

function post(path, body, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "localhost",
      port: 3000,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", chunk => { raw += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, raw }); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const username = `test_voter_${Date.now() % 10000}`;
  const password = "password123";

  console.log(`1. Signing up test voter: ${username}...`);
  const signupRes = await post("/api/auth/signup", { username, password });
  const voterToken = signupRes.body.token;

  console.log("2. Logging in as Admin to enroll voter...");
  const adminRes = await post("/api/auth/login", { username: "admin", password: "admin123" });
  const adminToken = adminRes.body.token;

  console.log(`3. Admin enrolling voter ${username}...`);
  const enrollRes = await post(`/api/admin/enroll/${username}`, {}, adminToken);
  console.log("   Enrolled on-chain. Leaf index:", enrollRes.body.leafIndex);

  console.log("4. Registering voter credentials (1-time issuance)...");
  const regRes = await post("/api/voters/register", { voterName: username }, voterToken);
  if (regRes.body.success) {
    console.log("   ✅ First registration succeeded!");
    console.log("   Real commitment:", regRes.body.real.commitment.slice(0, 24) + "...");
  } else {
    console.log("   ❌ Registration failed:", regRes.body.error);
  }

  console.log("5. Testing 1-per-account enforcement (attempting 2nd registration)...");
  const secondRes = await post("/api/voters/register", { voterName: username }, voterToken);
  if (secondRes.status === 403 && !secondRes.body.success) {
    console.log("   ✅ Second registration correctly BLOCKED (403):", secondRes.body.error);
  } else {
    console.log("   ❌ Expected 403 blocking second registration, got:", secondRes);
  }
}

run().catch(console.error);
