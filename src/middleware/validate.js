// Wraps a Zod schema as Express middleware. Every boundary (widget create/update,
// public submission) runs through here before touching business logic —
// bad input never reaches the database layer.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.validated = result.data;
    next();
  };
}

module.exports = { validateBody };
