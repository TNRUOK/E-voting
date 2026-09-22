/**
 * stop.js — Cleanly terminates all processes running on the project's assigned ports.
 */
"use strict";

const { execSync } = require("child_process");

const PORTS = [8545, 3000, 3001, 3002, 3003, 5173];

console.log("\n========================================================");
console.log("  Stopping All Threshold E-Voting Services");
console.log("========================================================\n");

const killedPids = new Set();

for (const port of PORTS) {
  try {
    let output = "";
    if (process.platform === "win32") {
      output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    } else {
      output = execSync(`lsof -i :${port} -t`, { encoding: "utf8" });
    }

    const lines = output.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = process.platform === "win32" ? parts[parts.length - 1] : parts[0];

      if (pid && !isNaN(pid) && pid !== "0" && !killedPids.has(pid)) {
        killedPids.add(pid);
        try {
          if (process.platform === "win32") {
            execSync(`taskkill /F /PID ${pid} /T`, { stdio: "ignore" });
          } else {
            execSync(`kill -9 ${pid}`, { stdio: "ignore" });
          }
          console.log(`[✓] Stopped process for port ${port} (PID: ${pid})`);
        } catch (_) {}
      }
    }
  } catch (_) {
    // Port wasn't in use, which is normal
  }
}

if (killedPids.size === 0) {
  console.log("No active services were found on ports " + PORTS.join(", "));
} else {
  console.log(`\nSuccessfully stopped ${killedPids.size} service process(es).`);
}

console.log("\n========================================================");
console.log("  All services stopped!");
console.log("========================================================\n");
