import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Page, Title, Button, C } from '../components/Screen';
import { api, readableError } from '../api/client';
import { useAuth } from '../store/auth';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentDetail'>;

type Player = {
  userId: string;
  username: string;
  status?: string;
};

type Match = {
  id: string;
  round: number;
  player1Id?: string | null;
  player2Id?: string | null;
  winnerId?: string | null;
  gameId?: string | null;
  status: string;
};

type Detail = {
  id: string;
  name: string;
  description?: string;
  status: string;
  maxPlayers?: number;
  createdBy?: string;
  players: Player[];
  matches: Match[];
};

export default function TournamentDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const r = await api.get(`/tournaments/${id}`);
      setData(r.data);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isJoined = data?.players?.some((p) => p.userId === user?.id);
  const isCreator = data?.createdBy === user?.id;

  const join = async () => {
    setBusy(true);
    try {
      await api.post(`/tournaments/${id}/join`);
      await load();
      Alert.alert('Joined', 'You are in this tournament.');
    } catch (e) {
      Alert.alert('Could not join', readableError(e));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    Alert.alert('Start tournament', 'Lock the bracket and create first-round games?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          setBusy(true);
          try {
            await api.put(`/tournaments/${id}/start`);
            await load();
          } catch (e) {
            Alert.alert('Could not start', readableError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const nameOf = (uid?: string | null) => {
    if (!uid) return 'TBD';
    const p = data?.players?.find((x) => x.userId === uid);
    return p?.username || uid.slice(0, 6);
  };

  if (loading) {
    return (
      <Page>
        <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
      </Page>
    );
  }

  if (!data) {
    return (
      <Page>
        <Text style={s.error}>{error || 'Tournament not found'}</Text>
        <Button title="Back" secondary onPress={() => navigation.goBack()} />
      </Page>
    );
  }

  const matchesByRound = (data.matches || []).reduce<Record<number, Match[]>>(
    (acc, m) => {
      const r = m.round || 1;
      (acc[r] = acc[r] || []).push(m);
      return acc;
    },
    {},
  );
  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Page>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={C.green}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </Pressable>
        <Title sub={data.description || 'Tournament bracket'}>{data.name}</Title>
        <View style={s.statusRow}>
          <Text style={s.status}>{data.status}</Text>
          <Text style={s.meta}>
            {data.players?.length ?? 0}/{data.maxPlayers ?? 8} players
          </Text>
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}

        {data.status === 'WAITING' && !isJoined && (
          <Button title="Join tournament" onPress={() => void join()} disabled={busy} />
        )}
        {data.status === 'WAITING' && isCreator && (data.players?.length ?? 0) >= 2 && (
          <Button title="Start tournament" onPress={() => void start()} disabled={busy} />
        )}
        {isJoined && data.status === 'WAITING' && (
          <Text style={s.hint}>You are registered. Waiting for the host to start.</Text>
        )}

        <Text style={s.section}>PLAYERS</Text>
        {(data.players || []).map((p) => (
          <View key={p.userId} style={s.playerRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{p.username?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.playerName}>
                {p.username}
                {p.userId === user?.id ? ' (you)' : ''}
              </Text>
              <Text style={s.meta}>{p.status || 'ACTIVE'}</Text>
            </View>
          </View>
        ))}

        {rounds.length > 0 && (
          <>
            <Text style={s.section}>BRACKET</Text>
            {rounds.map((round) => (
              <View key={round} style={{ marginBottom: 16 }}>
                <Text style={s.round}>Round {round}</Text>
                {matchesByRound[round].map((m) => {
                  const canOpen =
                    m.gameId &&
                    (m.player1Id === user?.id || m.player2Id === user?.id);
                  return (
                    <Pressable
                      key={m.id}
                      style={s.match}
                      disabled={!canOpen}
                      onPress={() => {
                        if (m.gameId) navigation.navigate('Game', { gameId: m.gameId });
                      }}
                    >
                      <Text style={s.matchLine}>
                        {nameOf(m.player1Id)} vs {nameOf(m.player2Id)}
                      </Text>
                      <Text style={s.meta}>
                        {m.status}
                        {m.winnerId ? ` · winner: ${nameOf(m.winnerId)}` : ''}
                        {canOpen ? ' · tap to play' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Page>
  );
}

const s = StyleSheet.create({
  back: { color: C.green, fontWeight: '800', marginBottom: 8 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  status: {
    color: C.green,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  meta: { color: C.muted, fontSize: 12 },
  hint: { color: C.muted, marginVertical: 10, lineHeight: 20 },
  section: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 10,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.green, fontWeight: '900' },
  playerName: { color: C.text, fontWeight: '800' },
  round: { color: C.text, fontWeight: '900', marginBottom: 8 },
  match: {
    backgroundColor: C.panel,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  matchLine: { color: C.text, fontWeight: '700' },
  error: { color: C.red, marginBottom: 10 },
});
