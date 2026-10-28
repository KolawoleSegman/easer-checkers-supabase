import React, { useState, useCallback, useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Page, Title, Button, C } from '../components/Screen';
import { api, readableError } from '../api/client';
import { useAuth } from '../store/auth';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type OpenRoom = {
  id: string;
  whiteUsername?: string;
  whiteId?: string;
};

export default function HomeScreen({ navigation }: Props) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [rooms, setRooms] = useState<OpenRoom[]>([]);

  const loadRooms = useCallback(() => {
    return api
      .get('/games/open')
      .then((r) => setRooms(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get('/users/me/stats')
      .then((r) => setStats(r.data))
      .catch(() => {});
    void loadRooms();
    const timer = setInterval(() => void loadRooms(), 12000);
    return () => clearInterval(timer);
  }, [loadRooms]);

  const create = async (isAI: boolean, difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'expert') => {
    setBusy(true);
    try {
      const r = await api.post('/games', {
        isAI,
        isMultiplayer: !isAI,
        difficulty: isAI ? difficulty : 'medium',
      });
      navigation.navigate('Game', { gameId: r.data.id });
    } catch (e) {
      Alert.alert('Could not start game', readableError(e));
    } finally {
      setBusy(false);
    }
  };

  const cancelRoom = async (roomId: string) => {
    try {
      await api.delete(`/games/${roomId}`);
      await loadRooms();
      Alert.alert('Room cancelled');
    } catch (e) {
      Alert.alert('Could not cancel', readableError(e));
    }
  };

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <View>
            <Text style={s.eyebrow}>EASER CHECKERS</Text>
            <Text style={s.greeting}>Hey, {user?.username || 'player'} 👋</Text>
          </View>
          <Pressable
            onPress={() => Alert.alert('Your account', user?.email || '')}
            style={s.avatar}
          >
            <Text style={{ color: C.green, fontWeight: '900', fontSize: 20 }}>
              {(user?.username || 'P')[0].toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <View style={s.hero}>
          <Text style={s.heroTag}>YOUR NEXT MOVE AWAITS</Text>
          <Text style={s.heroTitle}>
            Play smart.{'\n'}Win with style.
          </Text>
          <Text style={s.heroSub}>
            Every move tells a story. Make yours count.
          </Text>
          <Button
            title="Challenge Expert AI  →"
            onPress={() => create(true, 'expert')}
            disabled={busy}
          />
          <Button
            title="Play vs Hard AI"
            onPress={() => create(true, 'hard')}
            secondary
            disabled={busy}
          />
          <Button
            title="Find an online opponent"
            onPress={() => create(false)}
            secondary
            disabled={busy}
          />
          <Button
            title="Challenge a friend"
            onPress={() => navigation.navigate('Friends')}
            secondary
            disabled={busy}
          />
        </View>

        <Title sub="Waiting for an opponent? Join an open table.">
          Open rooms
        </Title>
        <View style={s.rooms}>
          {rooms.length === 0 ? (
            <Text style={s.empty}>
              No open rooms right now. Create one with “Find an online opponent”.
            </Text>
          ) : (
            rooms.slice(0, 8).map((room) => {
              const isMine = room.whiteId === user?.id;
              return (
                <View key={room.id} style={s.room}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() =>
                      navigation.navigate('Game', { gameId: room.id })
                    }
                  >
                    <Text style={s.roomName}>
                      {isMine
                        ? 'Your waiting room'
                        : `${room.whiteUsername || 'Player'}’s table`}
                    </Text>
                    <Text style={s.roomCode}>{room.id.slice(0, 8)}…</Text>
                  </Pressable>
                  {isMine ? (
                    <Pressable
                      onPress={() => void cancelRoom(room.id)}
                      style={s.cancelBtn}
                    >
                      <Text style={s.cancelText}>Cancel</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() =>
                        navigation.navigate('Game', { gameId: room.id })
                      }
                    >
                      <Text style={s.join}>JOIN →</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>

        <Title sub="Your progress at a glance">Player stats</Title>
        <View style={s.stats}>
          <Stat label="WINS" value={stats?.wins ?? '—'} />
          <Stat label="LOSSES" value={stats?.losses ?? '—'} />
          <Stat label="RATING" value={stats?.eloRating ?? '1200'} />
        </View>

        <View style={s.tip}>
          <Text style={{ fontSize: 21 }}>✦</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.tipTitle}>Think two moves ahead</Text>
            <Text style={s.tipBody}>
              Captures are mandatory in International draughts. Look for the
              longest capture sequence.
            </Text>
          </View>
        </View>

        <Pressable
          style={s.logout}
          onPress={() =>
            Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign out',
                style: 'destructive',
                onPress: () => void logout(),
              },
            ])
          }
        >
          <Text style={{ color: C.muted, fontWeight: '700' }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </Page>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: C.green,
    fontWeight: '900',
    marginBottom: 6,
  },
  greeting: { fontSize: 23, color: C.text, fontWeight: '800' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: C.panel,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#34483e',
  },
  heroTag: {
    color: C.green,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '900',
  },
  heroTitle: {
    color: C.text,
    fontSize: 35,
    fontWeight: '900',
    lineHeight: 40,
    marginTop: 13,
  },
  heroSub: { color: C.muted, fontSize: 13, marginTop: 10, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  stat: { flex: 1, backgroundColor: C.panel, borderRadius: 16, padding: 16 },
  statValue: { color: C.text, fontSize: 25, fontWeight: '900' },
  statLabel: {
    color: C.muted,
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: '800',
    marginTop: 7,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2c23',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#35513d',
  },
  tipTitle: { color: C.text, fontWeight: '800', marginBottom: 5 },
  tipBody: { color: C.muted, fontSize: 12, lineHeight: 18 },
  logout: { alignItems: 'center', padding: 24 },
  rooms: { marginTop: -12, marginBottom: 24 },
  empty: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    backgroundColor: C.panel,
    padding: 15,
    borderRadius: 14,
  },
  room: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  roomName: { color: C.text, fontWeight: '800' },
  roomCode: { color: C.muted, fontSize: 9, marginTop: 4 },
  join: { color: C.green, fontWeight: '900', fontSize: 11 },
  cancelBtn: {
    backgroundColor: C.panel2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cancelText: { color: C.red, fontWeight: '800', fontSize: 11 },
});
