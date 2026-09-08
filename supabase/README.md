# Supabase — Zenko Plads

Bucket `plads` er oprettet og er public read.

JSON-tabeller (live nu, uden at I opretter kolonner):

- `employees`, `projects`, `assignments`
- `todos`, `tfs`, `slips`, `ents`, `ks_reports`
- `orders`, `messages`, `plan_blocks`, `day_logs`
- `notices`, `needs`, `receipts`, `field_items`, `issues`
- `serials`, `yard_state`, `files`, `push_subs`

Hver række er `tables/{navn}/{id}.json`.

`schema.sql` er det samme skema som rigtige Postgres-tabeller. Kør den i Dashboard → SQL Editor, hvis I vil have REST `/rest/v1/employees` osv.

**Secret-nøglen må aldrig i sitet eller i GitHub.**
