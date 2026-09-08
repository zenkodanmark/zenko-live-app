# Zenko Plads

Felt-app til Zenko Danmark. Én PWA: PIN-login, mester- og svend-tavle, To-do / TF / AS / ER / KS / MA, chat og plan.

**Live-kode:** [zenkodanmark/zenko-live-app](https://github.com/zenkodanmark/zenko-live-app)

## Data (Supabase)

Appen bruger **rigtige SQL-tabeller** via supabase-klienten (`@supabase/supabase-js`).

1. Åbn Supabase Dashboard → **SQL Editor**.
2. Kør hele filen [`supabase/schema.sql`](supabase/schema.sql) (opretter tabeller + seed: ansatte, sager, tildelinger).
3. Bagefter skriver appen to-do, chat, KS, dage og ordrer ind i tabellerne.

Fotos gemmes i Storage-bucket `plads`. Ikke JSON-filer som database.

Publishable-nøglen (anon) ligger i `src/lib/supabase.ts`. Den er beregnet til klienten.

## Secret-nøglen må aldrig i sitet

Supabase **secret key** må **ikke** lægges i koden, i GitHub, i README eller i en committed `.env`. Kun som server-miljøvariabel `SUPABASE_SECRET_KEY`.

## Start

```sh
npm install
npm run dev
```

PIN-login er uændret. Log kun ud med knappen Log ud.
