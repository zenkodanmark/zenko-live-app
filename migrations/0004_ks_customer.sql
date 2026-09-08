-- Living KS customer site: which reports the master has ticked for the client.
-- Looked up by project slug. Rows are unowned (no login).
create table if not exists ks_customer_jobs (
  slug         text primary key,
  project_id   text not null,
  payload      jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);
create table if not exists ks_customer_reports (
  project_id   text not null,
  report_id    text not null,
  status       text not null default 'skjult',
  payload      jsonb,
  updated_at   timestamptz not null default now(),
  primary key (project_id, report_id)
);
create index if not exists ks_customer_reports_status_idx on ks_customer_reports (project_id, status);
