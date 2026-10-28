import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface UserInfo {
  username: string;
  avatar: string;
}

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; info: UserInfo | null }>();

/**
 * Display info (username + avatar) is needed on every game state we send.
 * Looking it up for both players on every move would be a wasted database
 * round-trip, so it is cached briefly in memory.
 */
export async function getUserInfo(userId: string): Promise<UserInfo | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.info;
  const [row] = await db
    .select({ username: users.username, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const info = row ? { username: row.username, avatar: row.avatar || '' } : null;
  cache.set(userId, { at: Date.now(), info });
  if (cache.size > 2000) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  return info;
}

export function invalidateUserInfo(userId: string) {
  cache.delete(userId);
}
