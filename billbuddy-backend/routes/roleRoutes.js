const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin } = require("../middleware/auth");

const router = express.Router();
const ROLE_NAMES = ["Super Admin", "Sales", "Seller Admin", "Seller User", "Demo User", "Master User", "Sub User", "Customer", "Admin"];

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM roles ORDER BY id`);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/seed", requirePlatformAdmin, async (_req, res) => {
  try {
    for (const roleName of ROLE_NAMES) {
      await pool.query(
        `INSERT INTO roles (role_name)
         VALUES ($1)
         ON CONFLICT (role_name) DO NOTHING`,
        [roleName]
      );
    }
    res.json({ message: "Roles seeded" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
