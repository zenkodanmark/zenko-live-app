-- Shared firm data (to-do, chat, KS, mødt/hjem) + Web Push.
create table if not exists yard_todos (
  id          text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);
create table if not exists yard_chats (
  id          text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);
create table if not exists yard_ks (
  id          text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);
create table if not exists yard_days (
  id          text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);
create table if not exists push_vapid (
  id           text primary key,
  public_key   text not null,
  private_key  text not null
);
create table if not exists push_subs (
  endpoint     text primary key,
  p256dh       text not null,
  auth         text not null,
  employee_id  text not null,
  role         text not null default '',
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists push_subs_employee_idx on push_subs (employee_id);
