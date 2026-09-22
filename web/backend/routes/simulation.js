"use strict";
const router = require("express").Router();
const { spawn } = require("child_process");
const path = require("path");

/**
 * GET /api/simulation/run
 *
 * Server-Sent Events (SSE) endpoint.
 * Spawns simulation/simulate.js as a child process and streams its stdout
 * line-by-line to the browser as SSE events.
 *
 * The simulation script sets IS_SSE=1 which makes it prefix each log line
 * with "data: " — we strip those and forward them as proper SSE data fields.
 */
router.get("/run", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const simulatePath = path.join(__dirname, "../../../simulation/simulate.js");

  const child = spawn(process.execPath, [simulatePath], {
    env: { ...process.env, IS_SSE: "1", FORCE_COLOR: "0" },
    cwd: path.join(__dirname, "../../.."),
  });

  const send = line => {
    // Strip ANSI colour codes for clean SSE output
    const clean = line.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
    // Strip SSE data prefix if the script added it
    const content = clean.startsWith("data: ") ? clean.slice(6) : clean;
    res.write(`data: ${content}\n\n`);
  };

  let buffer = "";
  child.stdout.on("data", chunk => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete last line
    lines.forEach(send);
  });

  child.stderr.on("data", chunk => {
    send(`[ERROR] ${chunk.toString().trim()}`);
  });

  child.on("close", code => {
    if (buffer) send(buffer);
    res.write(`data: [SIMULATION COMPLETE — exit code ${code}]\n\n`);
    res.write("event: done\ndata: done\n\n");
    res.end();
  });

  // If client disconnects, kill the child process
  req.on("close", () => {
    child.kill();
  });
});

module.exports = router;
