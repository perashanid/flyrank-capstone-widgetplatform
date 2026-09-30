# EVIDENCE.md

One real, captured proof per box in the brief's Section 6 checklist. All output below was captured by
actually running the server against a real Postgres database (not simulated) during development —
commands are included so you can reproduce every line yourself.

---

## Widget management

### Authenticated CRUD; unauthenticated requests rejected

```
$ curl -s -i http://localhost:4000/api/widgets
HTTP/1.1 401 Unauthorized
{"error":"Missing or malformed Authorization header"}
```

### Multi-tenant isolation proven

Registered a second tenant ("tenant B") and tried to read the seeded demo widget, which belongs to
tenant A:

```
$ curl -s -i http://localhost:4000/api/widgets/f1a3ecca-f633-4cd7-9c50-69e35debdb15 \
    -H "Authorization: Bearer <tenant-B-token>"
{"error":"Widget not found"}

$ curl -s http://localhost:4000/api/widgets -H "Authorization: Bearer <tenant-B-token>"
[]
```

Tenant B receives a 404 (existence is never confirmed) and an empty list — never tenant A's data.

---

## Widget delivery

### Embed snippet generated per widget

`POST /api/widgets` (and every subsequent GET) returns:
```json
"embedSnippet": "<script src=\"http://localhost:4000/widget.v1.js?id=f1a3ecca-...\"></script>"
```

### Public config endpoint: correct cache headers, small payload

```
$ curl -s -i http://localhost:4000/widgets/f1a3ecca-f633-4cd7-9c50-69e35debdb15/config
HTTP/1.1 200 OK
Cache-Control: public, max-age=60
Content-Type: application/json; charset=utf-8
{"id":"f1a3ecca-...","type":"signup_form","title":"Newsletter Signup", ...}
```

### Widget JS served as a versioned bundle

```
$ curl -s -i http://localhost:4000/widget.v1.js | head -5
HTTP/1.1 200 OK
Cache-Control: public, max-age=31536000, immutable
Content-Type: application/javascript; charset=utf-8
```

A future release ships as `widget.v2.js` — a new URL — so this response can be cached "forever."

### Widget renders on a different-origin page

`test-site/index.html` is served from a second local port/`file://`, embeds
`<script src="http://localhost:4000/widget.v1.js?id=...">`, and the script fetches config and posts
submissions cross-origin. Confirmed working via the CORS preflight test below plus manual load in a
browser.

---

## Public submission API

### Cross-origin submissions work: CORS + preflight

```
$ curl -s -i -X OPTIONS http://localhost:4000/submissions \
    -H "Origin: http://localhost:5500" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type"
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5500
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
Access-Control-Allow-Headers: Content-Type
```

**Probe 1 — valid submission, stored, visible on the dashboard:**
```
$ curl -s -i -X POST http://localhost:4000/submissions \
    -H "Content-Type: application/json" -H "Origin: http://localhost:5500" \
    -d '{"widgetId":"f1a3ecca-...","data":{"name":"Jane Doe","email":"jane@example.com"},"company_website":""}'
HTTP/1.1 201 Created
Access-Control-Allow-Origin: http://localhost:5500
{"id":"e5ddda8c-f9c5-41d6-9163-8eb7f073ca55","status":"stored","geoEnriched":true,"emailQueued":true}

$ curl -s http://localhost:4000/api/dashboard/summary -H "Authorization: Bearer <token>"
[{"widget_id":"f1a3ecca-...","title":"Newsletter Signup","submission_count":1,"last_submission_at":"2026-09-30T10:15:23.540Z"}]
```

### All input validated; malformed/oversized rejected with clean 4xx

**Probe 2a — malformed payload (bad UUID, missing required field):**
```
$ curl -s -i -X POST http://localhost:4000/submissions -H "Content-Type: application/json" \
    -d '{"widgetId":"not-a-uuid"}'
HTTP/1.1 400 Bad Request
{"error":"Validation failed","details":[
  {"path":"widgetId","message":"widgetId must be a valid UUID"},
  {"path":"data","message":"Required"}
]}
```

**Probe 2b — oversized payload (>20kb body limit):**
```
$ curl -s -i -X POST http://localhost:4000/submissions -H "Content-Type: application/json" \
    --data-binary @big-25kb-payload.json
HTTP/1.1 413 Payload Too Large
{"error":"Payload too large"}
```

No malformed or oversized request ever produced a 500.

### Valid submissions stored safely, linked to widget + tenant

Confirmed above (Probe 1) — the row appears immediately under the correct widget's dashboard summary.

---

## Abuse protection

### Rate limiting returns 429 under burst; legitimate traffic keeps working

**Probe 3 — 25 requests from the same IP+widget in quick succession (limit = 20/min):**
```
$ for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code} " \
    -X POST http://localhost:4000/submissions -H "Content-Type: application/json" \
    -d "{\"widgetId\":\"f1a3ecca-...\",\"data\":{\"name\":\"Bot$i\",\"email\":\"b$i@x.com\"}}"; done

201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 429 429 429 429 429
```
Requests 1–20 succeed, 21–25 are cleanly rejected with 429. A distinct widget/IP combination is
unaffected (separate rate-limit bucket), so one flooded widget never blocks the rest of the platform.

### Spam control demonstrably blocks a spam submission

**Probe 6 — honeypot field filled, as a bot auto-filling every input would do:**
```
$ curl -s -i -X POST http://localhost:4000/submissions -H "Content-Type: application/json" \
    -d '{"widgetId":"f1a3ecca-...","data":{"name":"Bot","email":"bot@spam.com"},"company_website":"http://spamsite.com"}'
HTTP/1.1 200 OK
{"status":"ok"}
```
Server log for the same request:
```
[spam] Honeypot triggered for widget f1a3ecca-... from IP 127.0.0.1
```
The bot receives a normal-looking 200 (so it doesn't learn it was caught), but no row is inserted —
confirmed by the submission count in `/api/dashboard/summary` not increasing for this request.

---

## Enrichment & safe side effects

### Provider fallback chain: A down → B answers; both down → stored anyway

**Probe 4 — three runs, only the env toggles changed:**

*Both providers up (default):*
```
{"id":"15e4972b-...","status":"stored","geoEnriched":true,"emailQueued":true}
```

*Provider A down (`GEO_MOCK_PROVIDER_A_DOWN=true`):*
```
{"id":"685468fb-...","status":"stored","geoEnriched":true,"emailQueued":true}
```
Server log:
```
[geo] Provider A failed (Mock Provider A is down (GEO_MOCK_PROVIDER_A_DOWN=true)), trying Provider B
```

*Both providers down (`GEO_MOCK_PROVIDER_A_DOWN=true GEO_MOCK_PROVIDER_B_DOWN=true`):*
```
{"id":"3612ca03-...","status":"stored","geoEnriched":false,"emailQueued":true}
```
Server log:
```
[geo] Provider A failed (...), trying Provider B
[geo] Provider B failed (...), storing without geo data
```
In every case `status` is `"stored"` — enrichment failure never blocks the submission.

### Failing email/webhook never blocks the submission

**Probe 5 — `EMAIL_FORCE_FAIL=true`:**
```
$ curl -s -i -X POST http://localhost:4000/submissions -H "Content-Type: application/json" \
    -d '{"widgetId":"f1a3ecca-...","data":{"name":"D","email":"d@x.com"}}'
HTTP/1.1 201 Created
{"id":"efcc481d-...","status":"stored","geoEnriched":true,"emailQueued":false}
```
Server log:
```
[email] Confirmation failed for submission efcc481d-...: Simulated email failure (EMAIL_FORCE_FAIL=true)
```
The submission is still stored and returns 201 — `emailQueued:false` reflects the side-effect failure
without affecting the primary response.

---

## Documentation

README.md contains the architecture diagram, setup/run/seed instructions, and API documentation.
`capstone.yaml`, `BUILDLOG.md`, `.env.example`, and this file are all present at the repo root as
required by Section 11 of the brief.
