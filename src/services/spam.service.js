// Honeypot field: a form field named "company_website" that is hidden via CSS
// in the real widget (see public/widget.v1.js) so humans never see or fill it,
// but naive bots that auto-fill every field will. If it arrives non-empty,
// the submission is spam.
const HONEYPOT_FIELD = "company_website";

function isSpam(body) {
  const value = body && body[HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = { isSpam, HONEYPOT_FIELD };
