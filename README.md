# Embeddable Widget & Lead-Capture Platform

FlyRank Internship · Backend Track · Capstone

A platform that lets a customer define a widget, hand out one `<script>` tag, and safely catch
submissions from the public internet — validated, rate-limited, spam-filtered, geo-enriched, and
dashboarded.

## Architecture

```
Widget Owner (authenticated, JWT)
  │
  ├─ POST/GET/PUT/DELETE /api/widgets        → tenant-isolated CRUD
  └─ GET /api/dashboard/*                    → counts, geo breakdown

Customer Website (any origin)
  <script src="http://api/widget.v1.js?id=123">
  │
  ├─ GET /widget.v1.js                       → public, cached forever (immutable)
  ├─ GET /widgets/:id/config                 → public, CORS, short cache (60s)
  └─ renders a form, wires up submission

Website Visitor (the untrusted public internet)
  POST /submissions  (public, CORS-enabled)
    │
    ├─ rate limit (per IP + widget)  ──fail──▶ 429, service stays up
    ├─ validate payload (Zod)        ──fail──▶ 400, never a 500
    ├─ honeypot check                ──spam──▶ 200 (looks normal), never stored
    ├─ geo enrichment
    │     Provider A ──fail──▶ Provider B ──fail──▶ store anyway, no geo
    ├─ store submission (Postgres, tenant-isolated)
    └─ email/webhook side effect     ──fail──▶ logged, submission still succeeds
```

Layers (`src/`):
```
routes/       HTTP concerns only — status codes, request/response shape
middleware/   auth, validation, rate limiting, error handling
services/     business logic touching external systems (geo, email, spam)
validators/   Zod schemas — single source of truth for "valid request"
db/           schema, migration runner, seed script
public/       widget.v1.js — the actual artifact customers embed
```

See `DESIGN.md` for the Phase 1 design doc (data model, API surface, one explicit non-goal).

## Quick start

Requires Docker + Docker Compose. No credit card, no external service, ever.

```bash
git clone <your-repo-url>
cd flyrank-capstone-widgetplatform
cp .env.example .env          # defaults work out of the box for local dev
docker compose up --build
```

In a second terminal, run the migration and seed:

```bash
docker compose exec app npm run migrate
docker compose exec app npm run seed
```

The seed script prints a demo tenant login and a widget ID + ready-to-use embed snippet. Copy that
`<script>` tag into `test-site/index.html` (replacing `WIDGET_ID`), then open it:

```bash
cd test-site && python3 -m http.server 5500
# visit http://localhost:5500 — a different origin/port than the API on :4000
```

Fill out the rendered form — the submission travels cross-origin to the API, gets validated,
rate-limited, geo-enriched, stored, and (in `EMAIL_MODE=smtp`) shows up in Mailpit's web UI at
`http://localhost:8025`.

### Running without Docker (local Postgres)

```bash
npm install
createdb widgetdb   # or run the equivalent CREATE DATABASE / CREATE ROLE from db/schema.sql's target
npm run migrate
npm run seed
npm start
```

## Environment variables

See `.env.example` for the full, documented list. The two worth knowing about up front:

- `GEO_MODE=mock` (default) uses deterministic mock geo providers so the fallback chain can be proven
  reliably (see `EVIDENCE.md`) without depending on third-party uptime. Set `GEO_MODE=live` to use the
  real free providers (`ip-api.com`, `ipapi.co`) during manual testing.
- `EMAIL_MODE=console` (default) logs confirmations instead of sending them. Set `EMAIL_MODE=smtp` with
  Docker Compose's bundled Mailpit to see real (fake) emails in a browser.

## API reference

Full machine-readable endpoint list: `capstone.yaml`. Summary:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Create a tenant, returns JWT |
| POST | `/auth/login` | — | Returns JWT |
| POST | `/api/widgets` | Bearer | Create a widget |
| GET | `/api/widgets` | Bearer | List this tenant's widgets |
| GET | `/api/widgets/:id` | Bearer | 404 if owned by another tenant |
| PUT | `/api/widgets/:id` | Bearer | Partial update |
| DELETE | `/api/widgets/:id` | Bearer | |
| GET | `/widget.v1.js?id=` | — | Public, `Cache-Control: immutable, max-age=31536000` |
| GET | `/widgets/:id/config` | — | Public, CORS, `Cache-Control: max-age=60` |
| POST | `/submissions` | — | Public, CORS, rate-limited, validated, spam-checked, geo-enriched |
| GET | `/api/dashboard/summary` | Bearer | Per-widget totals |
| GET | `/api/dashboard/widgets/:id/stats` | Bearer | Time series + geo breakdown |

## Testing the hardening yourself

```bash
# Rate limiting
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code} " -X POST \
  http://localhost:4000/submissions -H "Content-Type: application/json" \
  -d "{\"widgetId\":\"<id>\",\"data\":{\"name\":\"x$i\",\"email\":\"x$i@x.com\"}}"; done

# Geo fallback (requires restarting the app container with these env vars set)
GEO_MOCK_PROVIDER_A_DOWN=true docker compose up -d app
GEO_MOCK_PROVIDER_A_DOWN=true GEO_MOCK_PROVIDER_B_DOWN=true docker compose up -d app

# Email side-effect isolation
EMAIL_FORCE_FAIL=true docker compose up -d app
```

Full captured output for every one of the brief's 6 acceptance probes is in `EVIDENCE.md`.

## Honest limitations

- No visual widget-builder UI — the customer-facing widget is a plain styled form (see `DESIGN.md`'s
  explicit non-goal). The grade for this capstone is backend hardening, not frontend polish.
- Only two widget types (`signup_form`, `cta_popover`) are modeled; the schema supports adding more
  without a migration since `fields` is JSONB.
- Rate limiting uses an in-memory store (`express-rate-limit` default), which resets on restart and
  doesn't share state across multiple app instances. A Redis-backed store would be the production fix —
  flagged here rather than silently glossed over.
- Email is fake by design (`console` or Mailpit) per the brief's realistic-scope guidance — what's
  graded is that its failure never blocks a submission, not real deliverability.

## AI usage

See `BUILDLOG.md` for an honest account of where AI helped build this and where its first pass was
wrong.
