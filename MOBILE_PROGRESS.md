# Easer Checkers Mobile — Progress Update

## Feature matrix

| Feature | Status |
|---------|--------|
| Auth + SecureStore + session restore | ✅ |
| Lobby (AI, open rooms, cancel waiting room) | ✅ |
| Live multiplayer board (server-authoritative) | ✅ |
| Match history | ✅ |
| Friends (search, request, accept, challenge) | ✅ |
| **Leaderboard** (pull-to-refresh, highlight you) | ✅ |
| **Tournaments** (list, create, join, start, bracket, open match) | ✅ |
| **Sound effects** (move, capture, win, lose) + mute toggle | ✅ |
| **Live voice call** (WebRTC, multiplayer only) | ✅ (needs dev build) |
| EAS Android/iOS config | ✅ |

## Sounds
- Assets: `mobile/assets/sounds/{move,capture,win,lose}.mp3` (from web client)
- Helper: `src/lib/sounds.ts` via **expo-av**
- Auto-play on move/capture from live state updates and on game end
- Mute toggle on Profile

## Tournaments
- `TournamentsScreen` — list + create modal
- `TournamentDetailScreen` — players, join/start, bracket rounds, open your match
- Uses existing NestJS `/tournaments` endpoints

## Tabs
Home · History · Friends · Tournaments · Leaderboard · Profile

## Install note
```bash
cd mobile
npm install   # picks up expo-av
npx expo start
```
