-- Hak-felter + pdf-sti på Plads-rapporter. Ingen FK, ingen dummy-rækker rørt.
-- Kun ALTER hvis tabellen findes (lokal pglite har ikke Plads-tabellerne).
do $$
begin
  if to_regclass('public.ents') is not null then
    alter table public.ents add column if not exists kunde_status text;
    alter table public.ents add column if not exists pdf_path text;
  end if;
  if to_regclass('public.todos') is not null then
    alter table public.todos add column if not exists ledelse_status text;
    alter table public.todos add column if not exists kunde_status text;
    alter table public.todos add column if not exists pdf_path text;
  end if;
  if to_regclass('public.tfs') is not null then
    alter table public.tfs add column if not exists pdf_path text;
  end if;
  if to_regclass('public.slips') is not null then
    alter table public.slips add column if not exists pdf_path text;
  end if;
  if to_regclass('public.offers') is not null then
    alter table public.offers add column if not exists pdf_path text;
    alter table public.offers add column if not exists kunde_status text;
  end if;
  if to_regclass('public.serials') is not null then
    update public.serials set next = greatest(next, 2) where kind = 'er';
  end if;
end $$;
