-- Zenko Plads — Supabase schema
-- Paste this into Dashboard → SQL Editor. The API secret key cannot run DDL.
-- Secret key must NEVER be stored in the app, GitHub, or a committed .env.


create table if not exists employees (
  id text primary key,
  name text not null,
  role text not null,
  language text not null,
  pin text not null default '',
  pin_hash text,
  initials text,
  payroll_no text,
  phone text,
  profile_file_id text,
  extra jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists projects (
  id text primary key,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  radius_m int default 160,
  brief text,
  huddle text,
  next_task text,
  status text not null default 'active',
  customer text,
  created_by text,
  udbud_folder_id text,
  drive_root_id text,
  drive_map jsonb default '{}',
  source text,
  ks_type text,
  trade text,
  period text,
  quality_manager text,
  handed_over_at timestamptz,
  archived_at timestamptz,
  extra jsonb default '{}'
);

create table if not exists assignments (
  employee_id text not null,
  project_id text not null,
  primary key (employee_id, project_id)
);

create table if not exists todos (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists tfs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists slips (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists ents (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists ks_reports (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists plan_blocks (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists day_logs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists notices (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists needs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists receipts (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists field_items (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists issues (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists serials (
  kind text primary key,
  next int not null,
  year int not null default 2026
);

create table if not exists yard_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists files (
  id text primary key,
  project_id text,
  kind text,
  path text not null,
  name text,
  mime text,
  url text,
  bytes int,
  created_at timestamptz default now()
);

create table if not exists push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  employee_id text not null,
  role text,
  enabled boolean default true
);

create table if not exists yard_todos (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists yard_chats (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists yard_ks (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists yard_days (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists yard_needs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists yard_orders (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

insert into serials (kind, next, year) values
  ('as', 6, 2026),
  ('tf', 7, 2026),
  ('er', 1, 2026),
  ('ks', 5, 2026),
  ('mo', 1, 2026),
  ('fb', 1, 2026)
on conflict (kind) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('plads', 'plads', true, 52428800)
on conflict (id) do update set public = true;

do $$
declare t text;
begin
  foreach t in array array[
    'employees','projects','assignments','todos','tfs','slips','ents','ks_reports',
    'orders','messages','plan_blocks','day_logs','notices','needs','receipts',
    'field_items','issues','serials','yard_state','files','push_subs',
    'yard_todos','yard_chats','yard_ks','yard_days','yard_needs','yard_orders'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists zenko_all on %I', t);
    execute format('create policy zenko_all on %I for all using (true) with check (true)', t);
    execute format('grant all on table %I to anon, authenticated, service_role', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

drop policy if exists plads_select on storage.objects;
drop policy if exists plads_insert on storage.objects;
drop policy if exists plads_update on storage.objects;
drop policy if exists plads_delete on storage.objects;
create policy plads_select on storage.objects for select using (bucket_id = 'plads');
create policy plads_insert on storage.objects for insert with check (bucket_id = 'plads');
create policy plads_update on storage.objects for update using (bucket_id = 'plads');
create policy plads_delete on storage.objects for delete using (bucket_id = 'plads');
