# Round 4: SQLite -> Supabase Postgres

- Database is now Postgres (Supabase) via `pg` + drizzle. Set `DATABASE_URL` (Session pooler string).
  Tables, indexes and Row Level Security are created automatically on boot (`src/db/ddl.ts`);
  `npm run db:schema` exports the same SQL to `supabase/schema.sql`.
- All data access is async; game finish, stats, win streak and ELO run in one transaction.
  Stats use atomic upserts and ELO rows are locked, so simultaneous results can't corrupt each other.
- Case-insensitive unique indexes on email/username; unique (game, turn) for moves and
  (tournament, player) for tournament entries; real foreign keys.
- RLS enabled on every table (no policies) so Supabase's public API can't expose password hashes.
- Socket authentication moved to Socket.IO middleware (needs a DB lookup, so it must finish before events arrive).
  Rejected connections now surface as `connect_error`; the web game page shows the message.
- Search escapes `%`/`_` and is case-insensitive (`ILIKE`).
- Graceful shutdown closes the pool.
- `npm run db:import-sqlite -- <file>` copies an old SQLite database across (idempotent).
- Removed SQLite code, the old `drizzle/` and `prisma/` folders and a junk file called `scripts`.
- New guide: `SUPABASE_SETUP.md`.
- Tested against a real PostgreSQL 18: full human game with stats/ELO, leaderboard, search, AI game,
  3-player tournament with a bye, socket auth, SQLite import.

Not done: avatars still use local disk (Supabase Storage would be the follow-up).
