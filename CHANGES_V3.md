# Round 3: review, rule fixes and hardening

## Game rules (server, web and mobile share one Board class)
- A man that reaches the back row *in the middle of a capture* and can keep jumping is no longer
  crowned on the spot (it was turning into a king mid-chain). It is crowned only if the move ends there.
- Jumped pieces now block until the whole capture sequence ends (no jumping the same piece twice,
  no passing over / landing on a piece already taken in that sequence).
- Board snapshots carry `ghosts`; web and mobile restore an in-progress capture from them
  (mobile used to forget it and auto-selects the jumping piece now).
- Regression tests: `server: npm test`, `mobile: npm test`.

## Server
- **AI no longer freezes the server**: the search runs in a worker thread (max 2 at once) and falls back
  to inline search if the worker fails. Time budgets: easy 0.25s, medium 0.6s, hard 1.5s, expert 3.5s
  (expert had crept up to 7s, blocking every player on the single-threaded server).
- AI transposition table now distinguishes mid-capture positions.
- `.env` files are actually loaded before JWT_SECRET / DATA_DIR / ALLOWED_ORIGINS are read.
- Emails are case-insensitive (`A@x.com` and `a@x.com` were two accounts); duplicate sign-ups race safely.
- Friends: accepting a request can no longer un-block someone; blocking works without a prior
  friendship; requests to unknown users are rejected.
- Real `Dockerfile` for the server (it was empty); removed unused Nest boilerplate, broken e2e test
  and a stray root `package.json`.

## Web client
- Wrong password no longer reloads the page and erases the error message.
- Type-check, lint and build are clean (`npm run typecheck`, `npm run lint`); added missing dev dependencies.

## Mobile
- Type-check is clean.

## Still worth knowing
- Render's free plan wipes SQLite data on every restart (see DEPLOY.md).
- The board squares are coloured so the bottom-left square is light; FMJD standard has it dark.
  Purely cosmetic and consistent everywhere, so left as is.
- Games already in progress that used a mid-capture crowning under the old rules may replay slightly differently.
