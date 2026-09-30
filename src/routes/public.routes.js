const express = require("express");
const path = require("path");
const pool = require("../db/pool");
const { validateBody } = require("../middleware/validate");
const { submitSchema } = require("../validators/submission.schema");
const { submissionLimiter } = require("../middleware/rateLimiter");
const { isSpam } = require("../services/spam.service");
const { enrichIp } = require("../services/geo.service");
const { sendConfirmation } = require("../services/email.service");

const router = express.Router();

// ---- 1. Versioned widget bundle: long-cache, immutable ---------------------
// A new release would ship as widget.v2.js (a new URL), so this file can be
// cached "forever" by every browser and CDN in between without ever going stale.
router.get("/widget.v1.js", (req, res) => {
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "..", "..", "public", "widget.v1.js"));
});

// ---- 2. Public widget config: short-lived cache ----------------------------
// CORS is enabled globally in app.js (origin: true) so any customer site can
// fetch this. Cache is short because a title/field edit should show up soon.
router.get("/widgets/:id/config", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, type, title, description, fields, button_text, display_options FROM widgets WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Widget not found" });
    }
    const w = result.rows[0];
    res.set("Cache-Control", "public, max-age=60");
    res.json({
      id: w.id,
      type: w.type,
      title: w.title,
      description: w.description,
      fields: w.fields,
      buttonText: w.button_text,
      displayOptions: w.display_options,
    });
  } catch (err) {
    next(err);
  }
});

// ---- 3. Public submission endpoint: the hardened path ----------------------
// Order matters: body-parse (app.js) -> rate limit -> validate -> spam check
// -> geo enrich (never throws) -> store -> side effect (never blocks response).
router.post("/submissions", submissionLimiter, validateBody(submitSchema), async (req, res, next) => {
  try {
    const { widgetId, data, company_website } = req.validated;

    const widgetResult = await pool.query("SELECT id, tenant_id, title, fields FROM widgets WHERE id = $1", [
      widgetId,
    ]);
    if (widgetResult.rows.length === 0) {
      return res.status(404).json({ error: "Widget not found" });
    }
    const widget = widgetResult.rows[0];

    // Per-field length/required check against this widget's own field config —
    // the generic schema only caps size; this enforces the widget's own contract.
    const declaredFields = widget.fields || [];
    for (const f of declaredFields) {
      const value = data[f.name];
      if (f.required && (value === undefined || value.trim() === "")) {
        return res.status(400).json({ error: `Field "${f.name}" is required` });
      }
      if (value !== undefined && f.maxLength && value.length > f.maxLength) {
        return res.status(400).json({ error: `Field "${f.name}" exceeds max length of ${f.maxLength}` });
      }
    }

    // Honeypot: silently accept (so a bot doesn't learn it was caught) but never store.
    if (isSpam({ company_website })) {
      console.warn(`[spam] Honeypot triggered for widget ${widgetId} from IP ${req.ip}`);
      return res.status(200).json({ status: "ok" });
    }

    const ip = req.ip;
    const geo = await enrichIp(ip); // never throws — degrades to nulls

    const insertResult = await pool.query(
      `INSERT INTO submissions (widget_id, tenant_id, data, ip, country, city, geo_source)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [widgetId, widget.tenant_id, JSON.stringify(data), ip, geo.country, geo.city, geo.source]
    );
    const submission = insertResult.rows[0];

    // Safe side effect — failure here must NEVER change the response already
    // implied by the successful INSERT above.
    let emailSent = false;
    try {
      await sendConfirmation({
        to: data.email,
        widgetTitle: widget.title,
        submissionId: submission.id,
      });
      emailSent = true;
    } catch (emailErr) {
      console.error(`[email] Confirmation failed for submission ${submission.id}:`, emailErr.message);
    }
    if (emailSent) {
      pool
        .query("UPDATE submissions SET email_sent = true WHERE id = $1", [submission.id])
        .catch((e) => console.error("Failed to flag email_sent:", e.message));
    }

    res.status(201).json({
      id: submission.id,
      status: "stored",
      geoEnriched: geo.source !== null,
      emailQueued: emailSent,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
