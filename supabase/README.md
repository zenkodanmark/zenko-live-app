# Supabase — Zenko Plads

Kør **`schema.sql`** i Dashboard → SQL Editor (hele filen, én gang).

Den opretter rigtige tabeller med kolonner og lægger seed ind (6 ansatte, 8 sager, tildelinger, serienumre).

Appen bruger `@supabase/supabase-js` mod `/rest/v1/…`. Storage-bucket `plads` er kun til fotos og filer.

**Secret-nøglen må aldrig i sitet eller i GitHub.**
