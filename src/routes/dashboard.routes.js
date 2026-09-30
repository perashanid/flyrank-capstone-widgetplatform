const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard/summary — totals per widget, this tenant only.
router.get("/summary", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT w.id AS widget_id, w.title,
              COUNT(s.id)::int AS submission_count,
              MAX(s.created_at) AS last_submission_at
       FROM widgets w
       LEFT JOIN submissions s ON s.widget_id = w.id
       WHERE w.tenant_id = $1
       GROUP BY w.id, w.title
       ORDER BY submission_count DESC`,
      [req.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/widgets/:id/stats — counts over time + geo breakdown,
// scoped by both widget_id AND tenant_id so tenant B can never probe tenant A's stats.
router.get("/widgets/:id/stats", async (req, res, next) => {
  try {
    const ownerCheck = await pool.query("SELECT id FROM widgets WHERE id = $1 AND tenant_id = $2", [
      req.params.id,
      req.tenantId,
    ]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: "Widget not found" });
    }

    const [overTime, byCountry, total] = await Promise.all([
      pool.query(
        `SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS count
         FROM submissions WHERE widget_id = $1 AND tenant_id = $2
         GROUP BY day ORDER BY day ASC`,
        [req.params.id, req.tenantId]
      ),
      pool.query(
        `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*)::int AS count
         FROM submissions WHERE widget_id = $1 AND tenant_id = $2
         GROUP BY country ORDER BY count DESC`,
        [req.params.id, req.tenantId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM submissions WHERE widget_id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      ),
    ]);

    res.json({
      widgetId: req.params.id,
      total: total.rows[0].total,
      submissionsOverTime: overTime.rows,
      geoBreakdown: byCountry.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
