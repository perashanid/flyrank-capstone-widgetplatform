const rateLimit = require("express-rate-limit");
const config = require("../config");

// Keyed on IP + widgetId so one noisy widget can't exhaust another tenant's
// quota, and one IP flooding widget A doesn't get blocked from widget B
// unnecessarily narrow — but a single attacker hammering one widget is capped fast.
const submissionLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const widgetId = (req.body && req.body.widgetId) || "unknown-widget";
    return `${req.ip}:${widgetId}`;
  },
  handler: (req, res) => {
    res.status(429).json({ error: "Too many submissions — please slow down." });
  },
});

module.exports = { submissionLimiter };
