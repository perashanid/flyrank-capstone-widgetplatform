const express = require("express");
const pool = require("../db/pool");
const config = require("../config");
const { requireAuth } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { createWidgetSchema, updateWidgetSchema } = require("../validators/widget.schema");

const router = express.Router();
router.use(requireAuth);

function toApiShape(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    fields: row.fields,
    buttonText: row.button_text,
    displayOptions: row.display_options,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    embedSnippet: `<script src="${config.baseUrl}/widget.v1.js?id=${row.id}"></script>`,
  };
}

// POST /api/widgets
router.post("/", validateBody(createWidgetSchema), async (req, res, next) => {
  try {
    const { type, title, description, fields, buttonText, displayOptions } = req.validated;
    const result = await pool.query(
      `INSERT INTO widgets (tenant_id, type, title, description, fields, button_text, display_options)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
       RETURNING *`,
      [req.tenantId, type, title, description, JSON.stringify(fields), buttonText, JSON.stringify(displayOptions)]
    );
    res.status(201).json(toApiShape(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

// GET /api/widgets — only this tenant's widgets, ever.
router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM widgets WHERE tenant_id = $1 ORDER BY created_at DESC",
      [req.tenantId]
    );
    res.json(result.rows.map(toApiShape));
  } catch (err) {
    next(err);
  }
});

// GET /api/widgets/:id — 404 (not 403) if it belongs to another tenant,
// so we never confirm to a caller that a widget ID exists at all.
router.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM widgets WHERE id = $1 AND tenant_id = $2", [
      req.params.id,
      req.tenantId,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Widget not found" });
    res.json(toApiShape(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

// PUT /api/widgets/:id
router.put("/:id", validateBody(updateWidgetSchema), async (req, res, next) => {
  try {
    const existing = await pool.query("SELECT * FROM widgets WHERE id = $1 AND tenant_id = $2", [
      req.params.id,
      req.tenantId,
    ]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Widget not found" });

    const current = existing.rows[0];
    const merged = {
      type: req.validated.type ?? current.type,
      title: req.validated.title ?? current.title,
      description: req.validated.description ?? current.description,
      fields: req.validated.fields ?? current.fields,
      buttonText: req.validated.buttonText ?? current.button_text,
      displayOptions: req.validated.displayOptions ?? current.display_options,
    };

    const result = await pool.query(
      `UPDATE widgets
       SET type = $1, title = $2, description = $3, fields = $4::jsonb,
           button_text = $5, display_options = $6::jsonb, updated_at = now()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [
        merged.type,
        merged.title,
        merged.description,
        JSON.stringify(merged.fields),
        merged.buttonText,
        JSON.stringify(merged.displayOptions),
        req.params.id,
        req.tenantId,
      ]
    );
    res.json(toApiShape(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/widgets/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM widgets WHERE id = $1 AND tenant_id = $2 RETURNING id", [
      req.params.id,
      req.tenantId,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Widget not found" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
