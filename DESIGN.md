# Design Doc — Embeddable Widget & Lead-Capture Platform

**Phase 1 gate**, per the capstone brief: problem, data model, API surface, layer sketch, one explicit non-goal.

## Problem

Customers need to add a lead-capture form to any website they control by pasting a single `<script>`
tag. The backend behind that tag has to accept traffic from origins it doesn't control, validate
untrusted input, survive abuse, enrich submissions with geo data when possible, and never let a
non-critical failure (email, one geo provider) take down the critical path (storing the lead).

## Data model

Three tables — `tenants`, `widgets`, `submissions` — described in full in `db/schema.sql`.
Key decisions:
- `submissions.tenant_id` is denormalized (in addition to `widget_id`) so every dashboard query can
  filter by tenant directly, without a join, making isolation a one-column `WHERE` clause everywhere.
- `widgets.fields` and `widgets.display_options` are `JSONB` — the field list is customer-defined and
  variable-length, so a relational fields table would add complexity without adding safety here.
- Every foreign key is `NOT NULL` — an orphaned widget or submission should be impossible, not just discouraged.

## API surface

Three request paths, kept conceptually and physically separate (see `src/routes/`):
1. **Owner-authenticated** (`/auth/*`, `/api/widgets/*`, `/api/dashboard/*`) — JWT bearer, tenant-scoped.
2. **Public, cached** (`GET /widget.v1.js`, `GET /widgets/:id/config`) — no auth, CORS-open, cache headers matter more than anything else.
3. **Public, hardened** (`POST /submissions`) — no auth, CORS-open, and the only path that writes data
   coming directly from the open internet. Gets the most middleware: rate limit → validate → spam check → enrich → store → side effect.

Full endpoint list lives in `capstone.yaml`.

## Layer sketch

```
routes/        -> HTTP concerns only (status codes, request/response shape)
middleware/    -> cross-cutting: auth, validation, rate limiting, error handling
services/      -> business logic with external dependencies (geo, email, spam)
validators/    -> Zod schemas — the single source of truth for "what is a valid request"
db/            -> schema + migration + seed, raw SQL via `pg` (no ORM — the queries are simple
                  enough that an ORM would add a dependency without adding clarity)
public/        -> the actual artifact customers embed (widget.v1.js)
```

## One explicit non-goal

**No visual widget builder / drag-and-drop UI.** The widget UI rendered on the customer's site is
intentionally minimal (a styled `<form>`), and the "admin" side is a JSON API with no dashboard
frontend beyond what `EVIDENCE.md` demonstrates via curl. This is a backend capstone: the grade lives
in CORS correctness, validation, rate limiting, the fallback chain, and safe side effects — not in
pixel-perfect admin UI. A real frontend for widget authoring is a natural stretch goal, not part of
the core contract.
