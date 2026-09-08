-- Shared material needs + orders (MA).
create table if not exists yard_needs (
  id          text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);
create table if not exists yard_orders (
  id          text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);
