# Easer Checkers — server

NestJS + Socket.IO + Postgres (Supabase, via drizzle). International draughts (10x10) rules live in
`src/board/Board.ts`; the AI (`src/ai`) searches in a worker thread so it never blocks the server.

```bash
cp .env.example .env     # set JWT_SECRET and DATABASE_URL (see ../SUPABASE_SETUP.md)
npm install
npm run start:dev        # watch mode
npm test                 # builds, then runs the board rule tests
```

Environment: `DATABASE_URL` (required), `JWT_SECRET` (required in production), `ALLOWED_ORIGINS`, `DATA_DIR` (avatars), `PORT`.
Tables are created automatically on boot; `npm run db:schema` writes the same SQL to `supabase/schema.sql`.
Migrating old SQLite data: `npm run db:import-sqlite -- path/to/easer_checker.db`.
The same rules are mirrored in `client/src/lib/board.ts` and `mobile/src/lib/board.ts`
(identical `Board` class) — change all three together.
