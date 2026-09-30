const { z } = require("zod");

// `data` is intentionally loose (record of string -> short string) because the
// exact fields depend on the widget's own field config; per-field length is
// still capped here as a blanket boundary defense, on top of the 20kb body
// limit enforced by express.json() in app.js.
const submitSchema = z.object({
  widgetId: z.string().uuid("widgetId must be a valid UUID"),
  data: z.record(z.string().max(2000)).refine((obj) => Object.keys(obj).length <= 20, {
    message: "Too many fields in submission",
  }),
  // Honeypot field — humans never fill it, bots that auto-fill forms do.
  company_website: z.string().max(500).optional().default(""),
});

module.exports = { submitSchema };
