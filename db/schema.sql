-- FlyRank Capstone: Embeddable Widget & Lead-Capture Platform
-- Schema: tenants (widget owners), widgets, submissions.
-- Tenant isolation is enforced in application code on every query
-- (every widgets/submissions query is scoped by tenant_id), and reinforced
-- here with NOT NULL foreign keys + indexes for fast, safe filtering.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS widgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('signup_form', 'cta_popover')),
    title           TEXT NOT NULL,
    description     TEXT,
    fields          JSONB NOT NULL DEFAULT '[]',       -- [{ "name": "email", "label": "Email", "required": true }]
    button_text     TEXT NOT NULL DEFAULT 'Submit',
    display_options JSONB NOT NULL DEFAULT '{}',       -- { "position": "inline" | "bottom-right", "delaySeconds": 0 }
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_widgets_tenant_id ON widgets(tenant_id);

CREATE TABLE IF NOT EXISTS submissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id   UUID NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, -- denormalized for fast, isolated dashboard queries
    data        JSONB NOT NULL,             -- the submitted field values
    ip          TEXT,
    country     TEXT,
    city        TEXT,
    geo_source  TEXT,                       -- 'provider_a' | 'provider_b' | null (enrichment failed, stored anyway)
    email_sent  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_widget_id ON submissions(widget_id);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant_id ON submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_country ON submissions(country);
