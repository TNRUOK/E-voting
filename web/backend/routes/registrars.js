"use strict";
const router = require("express").Router();
const axios  = require("axios");
const { REGISTRAR_URLS } = require("../shared");

/**
 * GET /api/registrars/status
 * Proxies GET /status to all 3 registrars and returns combined status.
 * Shows request counters to prove distributed load, not which credentials.
 */
router.get("/status", async (req, res) => {
  const results = await Promise.allSettled(
    REGISTRAR_URLS.map(url => axios.get(`${url}/status`, { timeout: 2000 }))
  );

  const statuses = results.map((result, i) => {
    if (result.status === "fulfilled") {
      return { ...result.value.data, online: true };
    } else {
      return { id: i + 1, online: false, requestsHandled: 0, error: "Unreachable" };
    }
  });

  res.json({ success: true, registrars: statuses });
});

module.exports = router;
