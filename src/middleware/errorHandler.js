// Catch-all so an unexpected error is always a clean JSON 4xx/5xx, never a
// raw stack trace leaked to a public caller. express's built-in payload-too-large
// error (from express.json({limit})) is normalized to 413 here too.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = { errorHandler };
