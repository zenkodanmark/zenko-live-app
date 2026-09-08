-- Byggeledelse-side: hakket TF/AS/ER pr. sag, manuelle sagsfelter, TF-svar.
create table if not exists sag_ledelse_jobs (
  slug         text primary key,
  project_id   text not null,
  payload      jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);
create table if not exists sag_ledelse_items (
  project_id   text not null,
  kind         text not null,
  report_id    text not null,
  status       text not null default 'skjult',
  payload      jsonb,
  updated_at   timestamptz not null default now(),
  primary key (project_id, kind, report_id)
);
create index if not exists sag_ledelse_items_status_idx on sag_ledelse_items (project_id, kind, status);
create table if not exists sag_ledelse_replies (
  id           text primary key,
  project_id   text not null,
  tf_id        text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists sag_ledelse_replies_tf_idx on sag_ledelse_replies (tf_id, created_at);
