-- TB (tilbud) bor i offers. Tabellen manglede på live — hak/PDF ramte den.
-- Lokal pglite: opret kun hvis vi er i Plads-skemaet (serials findes).
do $$
begin
  if to_regclass('public.serials') is null then
    return;
  end if;
  if to_regclass('public.offers') is null then
    create table public.offers (
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
      pdf_path text,
      updated_at timestamptz default now()
    );
  end if;
  begin
    alter table public.offers enable row level security;
    drop policy if exists zenko_all on public.offers;
    create policy zenko_all on public.offers for all using (true) with check (true);
    grant all on table public.offers to anon, authenticated, service_role;
  exception when others then
    null;
  end;
end $$;
