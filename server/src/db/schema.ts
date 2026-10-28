import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).default(sql`now()`);

// ---- Users ----
export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  eloRating: integer('elo_rating').default(1200),
  avatar: text('avatar').default(''),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
});

// ---- Games ----
// blackId is a real user id, or the sentinels 'AI' / 'WAITING' (open seat).
// winnerId is a real user id or null. Neither is a FK to users so those
// sentinels never break inserts.
export const games = pgTable('games', {
  id: id(),
  whiteId: text('white_id')
    .notNull()
    .references(() => users.id),
  blackId: text('black_id').notNull(),
  winnerId: text('winner_id'),
  pgnMoves: text('pgn_moves').default(''),
  startedAt: timestamp('started_at', { withTimezone: true }).default(sql`now()`),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  status: text('status')
    .$type<'ACTIVE' | 'WHITE_WINS' | 'BLACK_WINS' | 'DRAW' | 'ABANDONED'>()
    .default('ACTIVE'),
  aiDifficulty: text('ai_difficulty').default('medium'),
});

// ---- Moves ----
export const moves = pgTable('moves', {
  id: id(),
  gameId: text('game_id')
    .notNull()
    .references(() => games.id),
  turnNumber: integer('turn_number').notNull(),
  fromSquare: text('from_square').notNull(),
  toSquare: text('to_square').notNull(),
  capturedPiece: text('captured_piece'),
  promotedToKing: boolean('promoted_to_king').default(false),
  createdAt: createdAt(),
});

// ---- Statistics ----
export const statistics = pgTable('statistics', {
  id: id(),
  userId: text('user_id')
    .unique()
    .notNull()
    .references(() => users.id),
  wins: integer('wins').default(0),
  losses: integer('losses').default(0),
  draws: integer('draws').default(0),
  totalMoves: integer('total_moves').default(0),
  averageTime: integer('average_time'),
  maxWinStreak: integer('max_win_streak').default(0),
});

// ---- Friendships ----
export const friendships = pgTable(
  'friendships',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    friendId: text('friend_id')
      .notNull()
      .references(() => users.id),
    status: text('status')
      .$type<'PENDING' | 'ACCEPTED' | 'BLOCKED'>()
      .default('PENDING'),
    createdAt: createdAt(),
  },
  (table) => ({
    unique: unique().on(table.userId, table.friendId),
  }),
);

// ---- Notifications ----
export const notifications = pgTable('notifications', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  type: text('type').notNull(),
  content: text('content').notNull(),
  read: boolean('read').default(false),
  createdAt: createdAt(),
});

// ---- Tournaments ----
export const tournaments = pgTable('tournaments', {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  maxPlayers: integer('max_players').default(8),
  status: text('status')
    .$type<'WAITING' | 'ACTIVE' | 'FINISHED'>()
    .default('WAITING'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: createdAt(),
});

// ---- Tournament Players ----
export const tournamentPlayers = pgTable(
  'tournament_players',
  {
    id: id(),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    seed: integer('seed').default(0),
    status: text('status')
      .$type<'ACTIVE' | 'ELIMINATED' | 'WINNER'>()
      .default('ACTIVE'),
    createdAt: createdAt(),
  },
  (table) => ({
    unique: unique().on(table.tournamentId, table.userId),
  }),
);

// ---- Tournament Matches ----
export const tournamentMatches = pgTable('tournament_matches', {
  id: id(),
  tournamentId: text('tournament_id')
    .notNull()
    .references(() => tournaments.id),
  round: integer('round').notNull(),
  player1Id: text('player1_id').references(() => users.id),
  player2Id: text('player2_id').references(() => users.id),
  winnerId: text('winner_id').references(() => users.id),
  gameId: text('game_id').references(() => games.id),
  nextMatchId: text('next_match_id'),
  status: text('status')
    .$type<'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>()
    .default('PENDING'),
  createdAt: createdAt(),
});
