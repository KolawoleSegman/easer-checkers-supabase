# Easer Checkers — Mobile Source Audit

Audit target: `easer-checker-main.zip` (uploaded project). This report describes source inspected in the archive and the mobile client added under `mobile/`.

## Verified architecture

- **Web client:** React 18 + TypeScript + Vite in `client/`; existing screens include Home, GamePage, GameBoard, Friends, History, Leaderboard, Profile, Replay, and Tournaments.
- **Backend:** NestJS 10 / TypeScript in `server/`.
- **Authentication:** `POST /auth/register`, `POST /auth/login`; bcrypt password hashing; JWT bearer tokens; Passport JWT guards for game, profile, users, friends, and tournament modules.
- **Persistence actually used by server code:** Drizzle ORM with `better-sqlite3`, schema bootstrap and SQLite tables in `server/src/db/`. A Prisma schema for PostgreSQL exists but is not the active persistence path in the inspected source.
- **Game API:** authenticated `POST /games`, `GET /games/:id`, `POST /games/:id/move`; this delivery adds `GET /games/open` for listing active waiting rooms.
- **Game engine:** shared web-client TypeScript engine uses 10×10 International draughts rules; mandatory captures, longest capture sequence and flying kings are implemented.
- **Sockets:** Socket.IO gateway authenticates using JWT handshake, supports `join_room`, `leave_room`, `make_move`, broadcasts `game_state`, emits `game_over`, and reports disconnections.
- **Player endpoints verified:** `GET /profile`, `GET /users/me/stats`, `GET /users/me/games`, `GET /users/search`, and `GET /users/leaderboard`.

## Mobile project added

`mobile/` is a separate Expo / React Native TypeScript application. The existing `client/` and `server/` were not replaced.

- Auth and registration forms with basic validation and backend error messages.
- SecureStore token persistence and session restoration through `/profile`.
- Zustand auth state.
- Navigation between Home, Game, Leaderboard, and Profile.
- AI and open multiplayer game creation using the existing API.
- A touch board that reuses the existing rules engine to highlight legal moves; moves are submitted to the server, which validates them authoritatively.
- Socket.IO room join/leave, live state updates, move errors, and opponent disconnect notice.
- Leaderboard, profile and stats use existing endpoints.
- EAS configuration and setup documentation.

## Known gaps / risks (not concealed)

1. Open-room discovery is now exposed through `GET /games/open` (up to 30 active waiting rooms, excluding the requesting player) and the mobile lobby refreshes the list periodically. Automatic pairing, invitation notifications, and room expiry/cancellation remain to be implemented.
2. The backend does not expose a password-recovery endpoint in the inspected source; no fake reset flow is shown in the app.
3. Leaderboard API currently returns up to 100 entries and does not accept pagination parameters. The mobile client consumes that response; server-side pagination still needs implementation for larger leaderboards.
4. Existing Prisma schema and active Drizzle/SQLite persistence are divergent. Do not migrate or switch database engines without a separate data migration plan.
5. The socket gateway validates token and room membership, but production deployment still needs valid `ALLOWED_ORIGINS`, shared `JWT_SECRET`, TLS, and persistent/shared database configuration. Multiple server instances would also need a Socket.IO adapter and shared game-state strategy.
6. The web and mobile apps currently depend on a configured/deployed API. A real-device build must set `EXPO_PUBLIC_API_URL` to a reachable HTTPS backend; local `localhost` will not refer to the developer machine from a phone.

## Verification status

- Source archive inspected and mobile project files created.
- Dependency installation was attempted but did not complete within the available command time; therefore TypeScript compilation, Jest tests, native bundling, EAS builds, and live API / multiplayer integration tests have **not** been verified. No passing test or build is claimed.

## Next steps for production readiness

1. Install mobile dependencies in a network-enabled environment and resolve TypeScript / Expo diagnostics.
2. Add automated unit tests for the reused draughts rules and integration tests against a disposable SQLite database.
3. Implement server-side open-room listing / matchmaking, explicit room invitation links, and server-enforced expiry/cancellation for waiting rooms.
4. Add cursor-based leaderboard pagination and review profile/statistics calculations.
5. Validate reconnect recovery, stale/duplicate moves, simultaneous move submissions, multi-capture continuation, game-end events, and Android/iOS device layouts against a running backend.
6. Configure EAS project identity, signing credentials, production API URL, privacy policy, and store metadata before distribution.
