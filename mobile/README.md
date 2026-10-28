# Easer Checkers Mobile (Expo + React Native)

This is a separate mobile app; the existing `client/` web app and `server/` backend remain in place.

## Current implementation
- React Native + Expo + TypeScript.
- React Navigation native stack and bottom tabs.
- Zustand auth state with session restoration.
- JWT persisted using Expo SecureStore; passwords are never persisted.
- Login and registration use the verified existing `/auth/login` and `/auth/register` endpoints.
- Game creation, open-room discovery, game-state retrieval and move submission use `/games`, `/games/open`, `/games/:id`, and `/games/:id/move`.
- Socket.IO uses the existing JWT handshake and `join_room`, `leave_room`, `game_state`, and `move_error` events.
- The existing 10x10 International draughts engine is reused from the web client for legal-move highlighting.
- Leaderboard and profile/stat data use the existing `/users/leaderboard`, `/profile`, and `/users/me/stats` endpoints.


## Live voice calls
- WebRTC signaling reuses the same Socket.IO game room (`call_offer`, `call_answer`, `ice_candidate`, `call_end`, `call_reject`).
- Mobile implementation lives in `src/hooks/useVoiceCall.ts` + `src/components/VoiceCallBar.tsx`.
- **Requires a development build** — `react-native-webrtc` does not work inside Expo Go.

```bash
cd mobile
npx expo install react-native-webrtc
npx expo prebuild
# then either:
npx expo run:android   # or run:ios
# or
eas build --profile development --platform android
```

- Optional but recommended: add TURN credentials in `src/lib/iceServers.ts` (same as the web client) so calls work on mobile data / strict NATs.

## Run locally
1. Install Node.js LTS and a compatible Expo Go app, or configure Android Studio / Xcode.
2. `cd mobile && npm install`
3. Set `EXPO_PUBLIC_API_URL` to your reachable backend URL when not using the configured default. For a physical device, `localhost` is the phone itself, not your development computer.
4. `npx expo start`
5. Use Expo Go for development, or `eas build --platform android --profile preview` / `eas build --platform ios --profile preview` for cloud builds after setting up an Expo account and app credentials.

## Important backend findings / caveats
- The server currently persists through Drizzle's SQLite implementation (`server/src/db/index.ts`, `server/src/db/schema.ts`). `server/prisma/schema.prisma` is present but is not the active persistence path in the inspected source.
- The backend JWT payload and passport strategy should be kept aligned. Verify the `JWT_SECRET` value is consistent between auth and WebSocket authentication in deployment.
- Existing backend route coverage is not uniform: this mobile app intentionally uses endpoints verified in source, rather than inventing matchmaking search or password-reset endpoints.
- The mobile delivery adds an authenticated `GET /games/open` endpoint that lists up to 30 active waiting rooms and surfaces them in the lobby. Automatic pairing without choosing a room, invitation notifications, and room expiry/cancellation are still not implemented.
- EAS builds and end-to-end multiplayer tests require a reachable configured backend, installed dependencies, and Expo credentials. No build or live-server success is claimed by this source delivery alone.
