-- Manual hours from MIG. Applied to Plads-Supabase as well.
create table if not exists time_entries (
  id text primary key,
  employee_id text not null,
  project_id text not null,
  date date not null,
  hours numeric not null,
  type text not null default 'normal',
  note text,
  lat double precision,
  lng double precision,
  created_at timestamptz default now(),
  created_by text
);

create table if not exists time_entry_files (
  id text primary key,
  entry_id text not null,
  file_id text not null,
  path text,
  mime text
);

create index if not exists time_entries_emp_date_idx on time_entries (employee_id, date);
create index if not exists time_entry_files_entry_idx on time_entry_files (entry_id);
