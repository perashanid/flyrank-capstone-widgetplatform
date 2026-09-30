// Seeds one demo tenant + one demo widget so a fresh clone has something to
// point the test-site at immediately after `npm run migrate && npm run seed`.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const email = "demo@flyrank.dev";
  const password = "demo12345";
  const passwordHash = await bcrypt.hash(password, 10);

  const tenantRes = await pool.query(
    `INSERT INTO tenants (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [email, passwordHash]
  );
  const tenantId = tenantRes.rows[0].id;

  const widgetRes = await pool.query(
    `INSERT INTO widgets (tenant_id, type, title, description, fields, button_text, display_options)
     VALUES ($1, 'signup_form', 'Newsletter Signup', 'Get our weekly digest',
             $2::jsonb, 'Subscribe', $3::jsonb)
     RETURNING id`,
    [
      tenantId,
      JSON.stringify([
        { name: "name", label: "Name", required: true, maxLength: 100 },
        { name: "email", label: "Email", required: true, maxLength: 200 },
      ]),
      JSON.stringify({ position: "inline" }),
    ]
  );

  console.log("Seeded demo tenant:");
  console.log("  email:   ", email);
  console.log("  password:", password);
  console.log("  tenantId:", tenantId);
  console.log("Seeded demo widget:");
  console.log("  widgetId:", widgetRes.rows[0].id);
  console.log("");
  console.log("Embed snippet for the test site:");
  console.log(
    `  <script src="${process.env.BASE_URL || "http://localhost:4000"}/widget.v1.js?id=${widgetRes.rows[0].id}"></script>`
  );

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
