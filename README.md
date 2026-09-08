# Zenko Plads

Felt-app til Zenko Danmark. Én PWA: PIN-login, mester- og svend-tavle, To-do / TF / AS / ER / KS / MA, chat og plan.

**Live-kode:** [zenkodanmark/zenko-live-app](https://github.com/zenkodanmark/zenko-live-app)

## Data (Supabase)

Ny data og nye filer ligger i Supabase Storage-bucket `plads`:

| Sti | Indhold |
| --- | --- |
| `yard/state.json` | Hele plads-snapshot (to-do, chat, KS, dage, ordrer …) |
| `tables/{tabel}/{id}.json` | En række pr. fil (`employees`, `projects`, `todos`, …) |
| `sager/{sag}/ks/…` | Nye KS-fotos |

Gamle Google Drive-filer kan stadig vises. Nye uploads går til Supabase.

Publishable-nøglen (anon) ligger i `src/lib/supabase.ts`. Den er beregnet til klienten.

## Secret-nøglen må aldrig i sitet

Supabase **secret key** må **ikke** lægges i koden, i GitHub, i README eller i en committed `.env`. Kun som server-miljøvariabel `SUPABASE_SECRET_KEY` (eller filen `.local/supabase-secret`, som er gitignored).

Secret-nøglen kan skrive til Storage. Den kan **ikke** køre `CREATE TABLE` — det er en begrænsning i Supabase API, ikke i appen.

Postgres-skemaet ligger i [`supabase/schema.sql`](supabase/schema.sql). Hvis I vil have rigtige SQL-tabeller: åbn SQL Editor i Supabase Dashboard og kør den fil. Appen kører uden det, fordi JSON-tabellerne i `plads` allerede er live.

## Start

```sh
npm install
npm run dev
```

PIN-login er uændret. Log kun ud med knappen Log ud.
