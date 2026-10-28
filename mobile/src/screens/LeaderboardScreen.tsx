import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Page, Title, C } from '../components/Screen';
import { api, readableError } from '../api/client';
import { useAuth } from '../store/auth';

type Player = {
  id: string;
  username: string;
  eloRating: number;
  wins?: number;
  losses?: number;
};

export default function LeaderboardScreen() {
  const me = useAuth((s) => s.user);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const r = await api.get('/users/leaderboard');
      setPlayers(Array.isArray(r.data) ? r.data : []);
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

  return (
    <Page>
      <Title sub="The players setting the pace.">Leaderboard</Title>
      {error ? <Text style={{ color: C.red, marginBottom: 10 }}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={C.green} />
      ) : (
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 30 }}
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
            <Text style={{ color: C.muted }}>Leaderboard is unavailable right now.</Text>
          }
          renderItem={({ item, index }) => {
            const isMe = item.id === me?.id;
            return (
              <View style={[s.row, isMe && s.meRow]}>
                <Text style={[s.rank, index < 3 && { color: C.green }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View style={s.avatar}>
                  <Text style={{ color: C.green, fontWeight: '900' }}>
                    {item.username?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>
                    {item.username}
                    {isMe ? ' (you)' : ''}
                  </Text>
                  <Text style={s.meta}>
                    {item.wins ?? 0} wins · {item.losses ?? 0} losses
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.elo}>{item.eloRating ?? 1200}</Text>
                  <Text style={s.meta}>RATING</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 15,
    padding: 14,
    marginBottom: 9,
    gap: 12,
  },
  meRow: { borderWidth: 1, borderColor: C.green },
  rank: { width: 24, color: C.muted, fontWeight: '900' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: C.text, fontWeight: '800' },
  meta: { color: C.muted, fontSize: 10, marginTop: 4 },
  elo: { color: C.green, fontSize: 18, fontWeight: '900' },
});
