# BUILDLOG.md — AI usage log

Per the brief's ground rules: AI-assisted building is encouraged and owned. This log is honest about
where AI (Claude) helped, where it needed correction, and what I changed.

## Where AI helped

- **Scaffolding the whole repo structure** (routes / middleware / services / validators split) in one
  pass, following the layer sketch in `DESIGN.md`, rather than building each piece file-by-file.
- **The geo fallback chain** (`src/services/geo.service.js`): the try/catch-into-try/catch pattern that
  guarantees `enrichIp()` never throws, plus the live-vs-mock provider split so the fallback can be
  proven deterministically without depending on two third-party APIs staying up during grading.
- **Zod schemas** for widget and submission validation — AI proposed the shape, I adjusted the
  `maxLength`/field-count limits to match what actually makes sense for a lead-capture form.
- **The honeypot pattern** in `public/widget.v1.js` (visually hidden via absolute positioning off-screen
  rather than `display:none`, since some bots skip `display:none` fields).
- **Writing `EVIDENCE.md`** by running the actual server against a real local Postgres instance and
  capturing real curl output for every requirement, rather than describing what the output "should" be.

## Where AI got it wrong / needed correction

- The first draft of the rate limiter used a key of `req.ip` alone. That would let one attacker on
  widget A block legitimate traffic to widget A only — but it would also mean a burst against widget A
  eats into the same bucket as requests to widget B from the same IP (e.g., an office NAT). I changed
  the `keyGenerator` to `${ip}:${widgetId}` specifically so noisy behavior on one widget doesn't
  collaterally rate-limit a different widget from the same network.
- The first pass at the honeypot handling returned a `400` when the honeypot was filled. That's wrong:
  a 400 teaches a bot exactly which field tipped it off, so it can be removed next time. I changed it
  to return a normal-looking `200 {"status":"ok"}` while silently dropping the row — verified in
  `EVIDENCE.md` Probe 6.
- Initial `submissions` schema didn't denormalize `tenant_id` (only had `widget_id`). Every dashboard
  query would have needed a join through `widgets` to filter by tenant, which is both slower and one
  extra place tenant isolation could be gotten wrong. Added `tenant_id` directly to `submissions` and
  indexed it.

## What I verified myself (not just trusted)

- Installed Postgres locally, ran `npm run migrate && npm run seed` against a real database, and
  manually ran all 6 acceptance probes from the brief with `curl`, capturing the actual output now in
  `EVIDENCE.md` — not written from what I expected the output to be.
- Read every route file and can explain, line by line, why `GET /api/widgets/:id` returns 404 (not 403)
  for another tenant's widget: a 403 confirms the ID exists at all, which is itself a tenant-isolation
  leak; 404 gives an attacker no signal either way.
- Confirmed the rate limiter's `keyGenerator` reads `req.body.widgetId`, which only works because
  `express.json()` runs before the rate limiter in the middleware chain in `app.js` — if that order
  were reversed, `req.body` would be `undefined` at that point and every request would share one
  rate-limit bucket. This ordering dependency is called out in a comment in `public.routes.js`.
