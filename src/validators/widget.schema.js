const { z } = require("zod");

const fieldSchema = z.object({
  name: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  required: z.boolean().optional().default(false),
  maxLength: z.number().int().positive().max(2000).optional().default(500),
});

const createWidgetSchema = z.object({
  type: z.enum(["signup_form", "cta_popover"]),
  title: z.string().min(1).max(150),
  description: z.string().max(500).optional().default(""),
  fields: z.array(fieldSchema).min(1).max(10),
  buttonText: z.string().min(1).max(40).optional().default("Submit"),
  displayOptions: z
    .object({
      position: z.enum(["inline", "bottom-right", "bottom-left"]).optional().default("inline"),
      delaySeconds: z.number().int().min(0).max(60).optional().default(0),
    })
    .optional()
    .default({}),
});

const updateWidgetSchema = createWidgetSchema.partial();

module.exports = { createWidgetSchema, updateWidgetSchema };
