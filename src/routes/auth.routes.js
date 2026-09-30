const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const pool = require("../db/pool");
const { signToken } = require("../utils/jwt");
const { validateBody } = require("../middleware/validate");

const router = express.Router();

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

// POST /auth/register — creates a new tenant (widget owner).
router.post("/register", validateBody(credsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const existing = await pool.query("SELECT id FROM tenants WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO tenants (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash]
    );
    const tenant = result.rows[0];
    const token = signToken(tenant);
    res.status(201).json({ token, tenant: { id: tenant.id, email: tenant.email } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post("/login", validateBody(credsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const result = await pool.query("SELECT id, email, password_hash FROM tenants WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const tenant = result.rows[0];
    const ok = await bcrypt.compare(password, tenant.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = signToken(tenant);
    res.json({ token, tenant: { id: tenant.id, email: tenant.email } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
