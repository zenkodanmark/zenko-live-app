alter table if exists todos add column if not exists ledelse_status text;
alter table if exists plan_blocks add column if not exists comment text;
alter table if exists plan_blocks add column if not exists days jsonb default '[]';
alter table if exists plan_blocks add column if not exists todo_id text;
