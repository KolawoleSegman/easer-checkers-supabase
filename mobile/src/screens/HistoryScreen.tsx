import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Page, Title, C } from '../components/Screen';
import { api, readableError } from '../api/client';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

type GameSummary = {
  id: string;
  status: string;
  result?: 'WIN' | 'LOSS' | 'DRAW' | 'ONGOING';
  opponentUsername?: string;
  isAI?: boolean;
  startedAt?: string;
  myColor?: string;
};

export default function HistoryScreen({ navigation }: Props) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const r = await api.get('/users/me/games');
      const list = Array.isArray(r.data) ? r.data : r.data?.games ?? [];
      setGames(list);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const label = (g: GameSummary) => {
    if (g.result === 'WIN') return 'Win';
    if (g.result === 'LOSS') return 'Loss';
    if (g.result === 'DRAW') return 'Draw';
    if (g.result === 'ONGOING' || g.status === 'ACTIVE') return 'In progress';
    return g.status || '—';
  };

  const color = (g: GameSummary) => {
    const l = label(g);
    if (l === 'Win') return C.green;
    if (l === 'Loss') return C.red;
    return C.muted;
  };

  const renderItem = ({ item }: { item: GameSummary }) => (
    <Pressable
      style={s.card}
      onPress={() => navigation.navigate('Game', { gameId: item.id })}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.opp}>
          {item.isAI ? 'Computer' : item.opponentUsername || 'Opponent'}
        </Text>
        <Text style={s.meta}>
          {item.isAI ? 'vs AI' : 'Online'}
          {item.myColor ? ` · you played ${item.myColor}` : ''}
          {' · '}
          {item.id.slice(0, 8)}…
        </Text>
      </View>
      <Text style={[s.result, { color: color(item) }]}>
        {label(item).toUpperCase()}
      </Text>
    </Pressable>
  );

  return (
    <Page>
      <Title sub="Your recent matches and results.">Match history</Title>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
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
          ListEmptyComponent={
            <Text style={s.empty}>
              No matches yet. Start a game from the lobby to build your record.
            </Text>
          }
        />
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  opp: { color: C.text, fontWeight: '800', fontSize: 15 },
  meta: { color: C.muted, fontSize: 11, marginTop: 4 },
  result: { fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  empty: {
    color: C.muted,
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  error: { color: C.red, marginBottom: 12, fontSize: 13 },
});
