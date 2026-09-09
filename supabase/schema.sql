-- Zenko Plads — rigtige Postgres-tabeller
-- Kør HELE filen i Supabase Dashboard → SQL Editor (én gang).
-- Secret-nøglen må ALDRIG i sitet / GitHub. Den kan ikke køre denne SQL.

drop table if exists
  yard_todos, yard_chats, yard_ks, yard_days, yard_needs, yard_orders, yard_state,
  todos, tfs, slips, ents, ks_reports, orders, messages, plan_blocks, day_logs,
  notices, needs, receipts, field_items, issues, serials, files, push_subs,
  threads, packs, suppliers, employees, projects, assignments
cascade;

create table employees (
  id text primary key,
  name text not null,
  role text not null,
  language text not null,
  pin text not null default '',
  initials text,
  payroll_no text,
  phone text,
  profile_file_id text,
  created_at timestamptz default now()
);

create table projects (
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
  source text,
  ks_type text,
  trade text,
  period text,
  quality_manager text,
  handed_over_at timestamptz,
  archived_at timestamptz,
  reopen_reason text,
  reopen_at timestamptz
);

create table assignments (
  employee_id text not null references employees(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  primary key (employee_id, project_id)
);

create table todos (
  id text primary key,
  project_id text,
  assignee_id text,
  assignee_ids jsonb default '[]',
  from_id text,
  title text,
  body text,
  kind text,
  due text,
  done boolean default false,
  done_at timestamptz,
  done_by_id text,
  needs_photo boolean,
  translations jsonb default '{}',
  drive_file_id text,
  photo_file_ids jsonb default '[]',
  lat double precision,
  lng double precision,
  gps_label text,
  source_lang text,
  original text,
  created_at timestamptz,
  reply text,
  history jsonb default '[]',
  done_photo_file_ids jsonb default '[]',
  done_gps_label text,
  done_lat double precision,
  done_lng double precision,
  order_id text,
  from_chat_id text,
  updated_at timestamptz default now()
);

create table messages (
  id text primary key,
  at timestamptz,
  from_id text,
  to_kind text,
  to_id text,
  to_ids jsonb default '[]',
  project_id text,
  source_lang text,
  original text,
  translations jsonb default '{}',
  via_voice boolean,
  thread_id text,
  photos jsonb default '[]',
  files jsonb default '[]',
  classified_as text,
  classified_at timestamptz,
  handled_at timestamptz,
  hidden_by jsonb default '[]',
  from_agent boolean,
  archived_at timestamptz,
  lat double precision,
  lng double precision,
  gps_label text,
  updated_at timestamptz default now()
);

create table ks_reports (
  id text primary key,
  number text,
  project_id text,
  point text,
  created_at timestamptz,
  status text,
  deviations text,
  approved boolean,
  employee_name text,
  employee_id text,
  crew text,
  process text,
  trade text,
  company text,
  photo_ids jsonb default '[]',
  location text,
  task text,
  from_chat_id text,
  kunde_status text,
  trashed_at timestamptz,
  qc_scope text,
  qc_method text,
  source text,
  updated_at timestamptz default now()
);

create table day_logs (
  id text primary key,
  employee_id text not null,
  date text not null,
  project_id text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  pause_started_at timestamptz,
  pause_minutes int default 0,
  photos jsonb default '[]',
  gps_inside boolean,
  check_in_gps jsonb,
  check_out_gps jsonb,
  demo_gps boolean,
  status text,
  work_note text,
  source text,
  payroll_minutes int,
  exception_reason text,
  exception_note text,
  double_booked boolean,
  payroll_no text,
  updated_at timestamptz default now()
);

create table tfs (
  id text primary key,
  number text,
  project_id text,
  title text,
  question text,
  created_at timestamptz,
  status text,
  answered boolean,
  answer text,
  answered_at timestamptz,
  answered_by text,
  photo_ids jsonb default '[]',
  from_chat_id text,
  ledelse_status text,
  ledelse_replies jsonb default '[]',
  kunde_status text,
  trashed_at timestamptz,
  share_token text,
  source text,
  updated_at timestamptz default now()
);

create table slips (
  id text primary key,
  number text,
  project_id text,
  title text,
  location text,
  body text,
  master_solution text,
  customer_price text,
  hours_est double precision,
  materials_est text,
  photo_ids jsonb default '[]',
  created_at timestamptz,
  status text,
  forwarded boolean,
  paid boolean,
  from_chat_id text,
  ledelse_status text,
  ledelse_replies jsonb default '[]',
  kunde_status text,
  trashed_at timestamptz,
  source text,
  updated_at timestamptz default now()
);

create table offers (
  id text primary key,
  number text,
  project_id text,
  title text,
  location text,
  body text,
  master_solution text,
  customer_price text,
  hours_est double precision,
  materials_est text,
  photo_ids jsonb default '[]',
  created_at timestamptz,
  status text,
  forwarded boolean,
  paid boolean,
  from_chat_id text,
  ledelse_status text,
  ledelse_replies jsonb default '[]',
  kunde_status text,
  trashed_at timestamptz,
  source text,
  updated_at timestamptz default now()
);

create table ents (
  id text primary key,
  number text,
  project_id text,
  title text,
  body text,
  location text,
  note_he text,
  created_at timestamptz,
  status text,
  photo_ids jsonb default '[]',
  from_chat_id text,
  ledelse_status text,
  ledelse_replies jsonb default '[]',
  materials_est text,
  hours_est double precision,
  trashed_at timestamptz,
  source text,
  updated_at timestamptz default now()
);

create table issues (
  id text primary key,
  employee_id text,
  project_id text,
  kind text,
  body text,
  urgent boolean,
  order_draft text,
  created_at timestamptz,
  status text,
  updated_at timestamptz default now()
);

create table plan_blocks (
  id text primary key,
  employee_id text,
  employee_ids jsonb default '[]',
  project_id text,
  title text,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz,
  created_by text,
  source text,
  place text,
  updated_at timestamptz default now()
);

create table notices (
  id text primary key,
  at timestamptz,
  kind text,
  title text,
  body text,
  to_ids jsonb default '[]',
  from_id text,
  ref_id text,
  project_id text,
  read_by jsonb default '[]'
);

create table needs (
  id text primary key,
  chat_id text,
  project_id text,
  from_id text,
  keywords jsonb default '[]',
  text text,
  at timestamptz,
  status text,
  updated_at timestamptz default now()
);

create table orders (
  id text primary key,
  number text,
  project_id text,
  need_id text,
  chat_id text,
  from_id text,
  product text,
  spec text,
  qty double precision,
  unit text,
  in_udbud boolean,
  cite text,
  file text,
  delivery_address text,
  expected_date text,
  supplier_email text,
  supplier_name text,
  nab text,
  customer text,
  cvr text,
  ordered_by text,
  ordered_at timestamptz,
  status text,
  mail_mode text,
  drive_file_id text,
  todo_id text,
  ks_report_id text,
  warning text,
  lines jsonb default '[]',
  phone text,
  driver_note text,
  thread jsonb default '[]',
  share_status text,
  public_path text,
  contact_employee_id text,
  updated_at timestamptz default now()
);

create table receipts (
  id text primary key,
  order_id text,
  project_id text,
  employee_id text,
  source text,
  photo_file_ids jsonb default '[]',
  at timestamptz,
  gps_label text,
  lat double precision,
  lng double precision,
  note text,
  guessed_product text,
  guessed_qty double precision,
  match text,
  warning text,
  drive_file_id text
);

create table field_items (
  id text primary key,
  project_id text,
  project_name text,
  employee_id text,
  employee_name text,
  kind text,
  name text,
  mime_type text,
  note text,
  taken_at timestamptz,
  status text,
  classified_as text,
  classified_at timestamptz,
  classified_by text,
  report_id text,
  drive_file_id text,
  drive_url text,
  drive_folder_id text,
  gps_label text,
  lat double precision,
  lng double precision,
  bytes int,
  updated_at timestamptz default now()
);

create table threads (
  id text primary key,
  title text,
  root_id text,
  project_id text,
  created_at timestamptz,
  saved_at timestamptz
);

create table packs (
  id text primary key,
  number text,
  project_id text,
  title text,
  created_at timestamptz,
  status text,
  slip_ids jsonb default '[]'
);

create table suppliers (
  id text primary key,
  name text,
  email text
);

create table serials (
  kind text primary key,
  next int not null,
  year int not null default 2026
);

create table files (
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

create table push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  employee_id text not null,
  role text,
  enabled boolean default true
);

create index todos_project_idx on todos (project_id);
create index messages_project_idx on messages (project_id);
create index ks_project_idx on ks_reports (project_id);
create index days_employee_idx on day_logs (employee_id, date);
create index orders_project_idx on orders (project_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('plads', 'plads', true, 52428800)
on conflict (id) do update set public = true;

do $$
declare t text;
begin
  foreach t in array array[
    'employees','projects','assignments','todos','messages','ks_reports','day_logs',
    'tfs','slips','offers','ents','issues','plan_blocks','notices','needs','orders','receipts',
    'field_items','threads','packs','suppliers','serials','files','push_subs'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists zenko_all on %I', t);
    execute format('create policy zenko_all on %I for all using (true) with check (true)', t);
    execute format('grant all on table %I to anon, authenticated, service_role', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;
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

notify pgrst, 'reload schema';

-- Seed (ansatte, sager, tildelinger, serienumre)
insert into employees (id, name, role, language, pin, initials, payroll_no) values
  ('emp-ole', 'Ole', 'mester', 'da', '7777', 'OL', null),
  ('emp-federico', 'Federico', 'mester', 'es', '2222', 'FO', null),
  ('emp-alex', 'Alex', 'laerling', 'da', '1111', 'AL', null),
  ('emp-ion', 'Ion Zafier', 'svend', 'ro', '3333', 'IZ', null),
  ('emp-marius', 'Marius Pater', 'svend', 'pl', '4444', 'MP', null),
  ('emp-osvaldo', 'Osvaldo', 'svend', 'es', '5555', 'OS', '0003')
on conflict (id) do update set name = excluded.name, role = excluded.role, language = excluded.language, pin = excluded.pin, initials = excluded.initials, payroll_no = excluded.payroll_no;

insert into projects (id, name, address, lat, lng, radius_m, brief, huddle, next_task, status, customer, created_by, udbud_folder_id, source, ks_type, handed_over_at, archived_at) values
  ('job-hillerodsholm', 'Hillerødsholm', 'Selskovvej 24–26, 3400 Hillerød', 55.9298, 12.3105, 180, 'NAB afd. 4121. Eksisterende 360 mm mur, hulmur 1.–2. sal. Indblæst stenuld, bindere, omfugning. Dalux + Drive.', 'I dag: altan-rep 5.4, filsning vange 5.5, udkasning skorsten 5.7. 64 KS-fotos i Drive — ret Grok hvis forkert.', 'KS 5.4 / 5.5 / 5.7 — åbn foto, ret punkt hvis Grok tager fejl.', 'active', 'Ole Jepsen A/S', 'emp-ole', '1sY1Zxbb0KN9tWZITKun_JQ3Kom9LDSc_', 'Dalux + Google Drev', 'alm', null, null),
  ('job-islevvaenge', 'Islevvænge', 'Fortvej 50, 2610 Rødovre', 55.7034, 12.4535, 200, 'Arne Jacobsen-rækkehuse, Rødovre afd. 2304. Gule og røde huse Fortvej/Knudsbølvej. Udbud: ISV_K01_C08.2_Zmur og Ztag i 01 Udbud.', 'Uge 37 man: puds gavle røde Fortvej. Fuger 20 mm, KC 50/50/700, skrabefuge, ingen afsyring.', 'Puds gavle røde huse, Fortvej — se Zmur 213.202.', 'active', 'Ole Jepsen A/S', 'emp-ole', '1jrKrS6Q0T7Sa1cfbr-wYDejr-r2KGsBx', 'Byggeweb', 'alm', null, null),
  ('job-kaerhuset', 'Kærhuset', 'Kær Bygade 8, 6400 Sønderborg', 54.9475, 9.851, 160, 'Mur og sokkel ved Kær. Ruskær 35 er samme sag. Afdækning ved nedbør. Drive.', 'Sokkelmembran 5.1 og afdækning 6.1. Stillads mod gadekæret.', 'KS 5.1 — sokkelmembran, 200 mm over terræn.', 'active', 'Ole Jepsen A/S', 'emp-ole', '1b4TUbmrrOr7xc8EuYHhZrsYYNUUVJPm4', 'Drive', 'alm', null, null),
  ('job-solbakkegaard', 'Solbakkegård', 'Vester Snogbæk 15, 6400 Sønderborg', 54.912, 9.792, 160, 'Gårdanlæg — tegl, overliggere og afdækning.', 'Overligger 4.1 i stuehuset. Afdæk murkrone inden aften.', 'KS 4.1 — ståloverligger HEA 160, stuehus øst.', 'archived', 'Ole Jepsen A/S', 'emp-ole', '12PaFXLv0PE-Tk4Mp20eGhwNQseQuo8Sx', 'Dalux', null, '2025-09-01', '2025-09-01T12:00:00.000Z'),
  ('job-skole', 'Skole', 'Skole (sted mangler i Dataløn)', 55.93, 12.31, 120, 'Tre dage i marts: fuge out. Sagsnummer stod tomt i Dataløn.', 'Fuge out.', 'Fuge out.', 'archived', 'Ole Jepsen A/S', 'emp-ole', '10ZI4-PFoenKHU0ezBbCrAauAkgCHxilI', 'Dataløn-kommentar', null, '2021-09-15', '2021-09-15T12:00:00.000Z'),
  ('job-soren-privat', 'Søren privat', 'Privat sag — adresse mangler', 55.676, 12.568, 120, 'Lille privat sag. Adresse mangler. Samme mappetræ som Hillerødsholm.', 'Uge 37 tirsdag: Marius.', 'Udførsel tirsdag.', 'active', 'Privat', 'emp-ole', '1rSzZ5M_Gma3PUgE0Hf2Nr8LtSxBdFkl_', 'Oprettet af mester-bot', null, null, null),
  ('job-klostergaarden', 'Klostergården Hillerød', 'Klostervej 1–15, 3400 Hillerød', 55.9324, 12.2978, 160, 'Lejerbo Klostergården. Samme mappetræ som Hillerødsholm: 01–07 + 00 Admin.', 'Uge 37: Federico og Osvaldo.', 'Udførsel uge 37.', 'active', 'Ole Jepsen A/S', 'emp-ole', '1jzE96Pk4T3POs2i7_LtU-LXMclKx5NMX', 'Oprettet af mester-bot', null, null, null),
  ('job-provestenen', 'Prøvestenen Frederiksværk', 'Strandvejen 84, 3300 Frederiksværk', 55.9706, 11.9985, 160, 'Strandvejen 84. Fuge out blok C/D, sten og vindueslysninger. Puds kælder uge 37.', 'Uge 37 tirsdag–onsdag: Ole og Alex, puds kælder.', 'Puds kælder tirsdag og onsdag.', 'active', 'Ole Jepsen A/S', 'emp-ole', '14L-6haGCy5Yg6mB_00dsfX5KvRj52k66', 'Dataløn 2501 + mester-bot', null, null, null)
on conflict (id) do update set name = excluded.name, address = excluded.address, brief = excluded.brief, huddle = excluded.huddle, next_task = excluded.next_task, status = excluded.status;

insert into assignments (employee_id, project_id) values
  ('emp-ole', 'job-hillerodsholm'),
  ('emp-ole', 'job-islevvaenge'),
  ('emp-ole', 'job-kaerhuset'),
  ('emp-ole', 'job-solbakkegaard'),
  ('emp-federico', 'job-hillerodsholm'),
  ('emp-federico', 'job-islevvaenge'),
  ('emp-federico', 'job-kaerhuset'),
  ('emp-federico', 'job-solbakkegaard'),
  ('emp-alex', 'job-hillerodsholm'),
  ('emp-ion', 'job-hillerodsholm'),
  ('emp-ion', 'job-islevvaenge'),
  ('emp-marius', 'job-hillerodsholm'),
  ('emp-marius', 'job-kaerhuset'),
  ('emp-osvaldo', 'job-hillerodsholm'),
  ('emp-osvaldo', 'job-islevvaenge'),
  ('emp-osvaldo', 'job-kaerhuset'),
  ('emp-osvaldo', 'job-provestenen'),
  ('emp-ole', 'job-soren-privat'),
  ('emp-ole', 'job-klostergaarden'),
  ('emp-ole', 'job-provestenen'),
  ('emp-federico', 'job-soren-privat'),
  ('emp-federico', 'job-klostergaarden'),
  ('emp-federico', 'job-provestenen'),
  ('emp-marius', 'job-islevvaenge'),
  ('emp-marius', 'job-soren-privat'),
  ('emp-alex', 'job-islevvaenge'),
  ('emp-alex', 'job-provestenen'),
  ('emp-osvaldo', 'job-klostergaarden')
on conflict do nothing;

insert into serials (kind, next, year) values
  ('as', 6, 2026), ('tb', 1, 2026), ('tf', 7, 2026), ('er', 1, 2026), ('ks', 5, 2026), ('mo', 1, 2026), ('fb', 1, 2026)
on conflict (kind) do nothing;

notify pgrst, 'reload schema';
