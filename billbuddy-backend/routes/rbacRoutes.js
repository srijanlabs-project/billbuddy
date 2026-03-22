const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin } = require("../middleware/auth");
const { getRbacConfigForUser, saveScopeConfiguration } = require("../services/rbacService");

const router = express.Router();

router.get("/config", async (req, res) => {
  try {
    const config = await getRbacConfigForUser(req.user, pool);
    return res.json(config);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/config", requirePlatformAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const scope = String(req.body?.scope || "").trim().toLowerCase();
    const matrix = req.body?.matrix;

    if (!["platform", "seller"].includes(scope)) {
      return res.status(400).json({ message: "scope must be platform or seller" });
    }

    await client.query("BEGIN");
    const updatedScope = await saveScopeConfiguration(scope, matrix, client);
    await client.query("COMMIT");

    return res.json({
      message: `${scope === "platform" ? "Platform" : "Seller"} RBAC updated successfully.`,
      scope,
      config: updatedScope
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
