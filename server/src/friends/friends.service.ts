import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { db } from '../db';
import { friendships, users } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';

@Injectable()
export class FriendsService {
  async getFriends(userId: string) {
    // Accepted friends in either direction, with avatar for the UI.
    const friends = await db
      .select({
        userId: friendships.friendId,
        username: users.username,
        avatar: users.avatar,
        eloRating: users.eloRating,
      })
      .from(friendships)
      .innerJoin(users, eq(friendships.friendId, users.id))
      .where(
        and(eq(friendships.userId, userId), eq(friendships.status, 'ACCEPTED')),
      );
    const reverse = await db
      .select({
        userId: friendships.userId,
        username: users.username,
        avatar: users.avatar,
        eloRating: users.eloRating,
      })
      .from(friendships)
      .innerJoin(users, eq(friendships.userId, users.id))
      .where(
        and(
          eq(friendships.friendId, userId),
          eq(friendships.status, 'ACCEPTED'),
        ),
      );
    return [...friends, ...reverse];
  }

  async getPendingRequests(userId: string) {
    return db
      .select({
        id: friendships.id,
        userId: friendships.userId,
        username: users.username,
        avatar: users.avatar,
      })
      .from(friendships)
      .innerJoin(users, eq(friendships.userId, users.id))
      .where(
        and(
          eq(friendships.friendId, userId),
          eq(friendships.status, 'PENDING'),
        ),
      );
  }

  async sendRequest(senderId: string, targetId: string) {
    if (senderId === targetId)
      throw new ConflictException('Cannot friend yourself');
    const target = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetId));
    if (!target.length) throw new NotFoundException('User not found');
    const existing = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.userId, senderId),
            eq(friendships.friendId, targetId),
          ),
          and(
            eq(friendships.userId, targetId),
            eq(friendships.friendId, senderId),
          ),
        ),
      );
    if (existing.length)
      throw new ConflictException('Friendship already exists');
    try {
      await db.insert(friendships).values({
        userId: senderId,
        friendId: targetId,
        status: 'PENDING',
      });
    } catch {
      // unique (user, friend): two requests at the same instant
      throw new ConflictException('Friendship already exists');
    }
    return { message: 'Request sent' };
  }

  async acceptRequest(userId: string, friendId: string) {
    const updated = await db
      .update(friendships)
      .set({ status: 'ACCEPTED' })
      .where(
        and(
          eq(friendships.userId, friendId),
          eq(friendships.friendId, userId),
          eq(friendships.status, 'PENDING'),
        ),
      )
      .returning();
    if (!updated.length) throw new NotFoundException('Request not found');
    return { message: 'Friend added' };
  }

  async removeFriend(userId: string, targetId: string) {
    await db
      .delete(friendships)
      .where(
        or(
          and(
            eq(friendships.userId, userId),
            eq(friendships.friendId, targetId),
          ),
          and(
            eq(friendships.userId, targetId),
            eq(friendships.friendId, userId),
          ),
        ),
      );
    return { message: 'Removed' };
  }

  async blockUser(userId: string, targetId: string) {
    if (userId === targetId) throw new ConflictException('Cannot block yourself');
    // Replace any existing relationship with one BLOCKED row owned by the
    // blocker (so it is clear who blocked whom, and it works even when the
    // two were never friends).
    await db.transaction(async (tx) => {
      await tx
        .delete(friendships)
        .where(
          or(
            and(eq(friendships.userId, userId), eq(friendships.friendId, targetId)),
            and(eq(friendships.userId, targetId), eq(friendships.friendId, userId)),
          ),
        );
      await tx
        .insert(friendships)
        .values({ userId, friendId: targetId, status: 'BLOCKED' });
    });
    return { message: 'Blocked' };
  }
}
