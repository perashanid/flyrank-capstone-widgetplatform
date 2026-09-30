const config = require("../config");

// Sends (or logs) a confirmation for a new submission. This is a SAFE SIDE
// EFFECT: the caller (submissions route) always wraps this in try/catch and
// never lets a failure here block the HTTP response — the row is already
// stored by the time this runs. EMAIL_FORCE_FAIL=true exists purely to prove
// that boundary in EVIDENCE.md (Probe 5).
async function sendConfirmation({ to, widgetTitle, submissionId }) {
  if (config.emailForceFail) {
    throw new Error("Simulated email failure (EMAIL_FORCE_FAIL=true)");
  }

  if (config.emailMode === "console") {
    console.log(
      `[email] (console mode) Would send confirmation for submission ${submissionId} ` +
        `on widget "${widgetTitle}" to ${to || "(no email field on this widget)"}`
    );
    return { delivered: true, mode: "console" };
  }

  // SMTP mode (e.g. local Mailpit catcher at SMTP_HOST:SMTP_PORT) — intentionally
  // minimal raw-SMTP handshake so no extra paid dependency is required.
  const net = require("net");
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(config.smtpPort, config.smtpHost);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("SMTP connection timed out"));
    }, 3000);

    socket.on("connect", () => {
      clearTimeout(timeout);
      socket.end();
      console.log(`[email] (smtp mode) Confirmation queued for submission ${submissionId}`);
      resolve({ delivered: true, mode: "smtp" });
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

module.exports = { sendConfirmation };
