# Supabase (Postgres) setup — step by step

## 1. Create the project
1. Sign in at supabase.com (you can use "Continue with GitHub").
2. **New project** → pick a name, a strong **database password** (save it!), and the region closest to your Render backend.
3. Wait ~2 minutes until the project is ready.

## 2. Get the connection string
1. Click **Connect** at the top of the project.
2. Choose **Session pooler** and copy the URI. It looks like
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`
3. Replace `[YOUR-PASSWORD]` with your password. If the password has special characters (`@ : / # ?`), URL-encode them (`@` → `%40`).

> Use the **Session pooler**, not "Direct connection". Direct connections are IPv6-only and Render can't reach them.

## 3. Run locally
```bash
cd server
cp .env.example .env     # fill in DATABASE_URL and JWT_SECRET
npm install
npm run start:dev
```
On first start the server creates every table itself. (Optional: `npm run build && npm run db:schema` writes `supabase/schema.sql` if you prefer to paste the SQL into Supabase → SQL Editor.)

Check Supabase → **Table Editor**: you should see `users`, `games`, `moves`, … each marked with RLS enabled.

## 4. Deploy on Render
1. Render → your backend service → **Environment** → add `DATABASE_URL` (the string from step 2).
2. Make sure `JWT_SECRET` and `ALLOWED_ORIGINS` are set, then redeploy.
3. Logs should say `Server running on port …` — if they say `DATABASE_URL is not set` or a connection error, re-check the string/password.

## 5. Move your old SQLite data (skip if you have none)
```bash
cd server
npm install && npm run build
DATABASE_URL="postgresql://..." npm run db:import-sqlite -- ./data/easer_checker.db
```
It copies users, games, moves, stats, friends and tournaments. It is safe to run twice.

## 6. Good to know
- **Don't put the Supabase `service_role` key anywhere** — this app doesn't need any Supabase API keys, only `DATABASE_URL`.
- Row Level Security is on for all tables with no policies, so nobody can reach your data through Supabase's public API; only your server (the `postgres` role) can.
- Supabase **Free projects pause after ~1 week of inactivity** and have no automatic backups. For a real launch use a paid plan (daily backups).
- Run only **one** backend instance: live-game locks and the move cache are in memory.
- Avatars are still stored on the server's disk. To make them durable too, the next step is Supabase Storage.
