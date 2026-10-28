import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Page, Title, Button, C } from '../components/Screen';
import { api, readableError } from '../api/client';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

type Friend = {
  userId: string;
  username: string;
  avatar?: string;
  eloRating?: number;
};

type Pending = {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
};

type SearchHit = {
  id: string;
  username: string;
  eloRating?: number;
};

export default function FriendsScreen({ navigation }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [f, p] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/requests'),
      ]);
      setFriends(Array.isArray(f.data) ? f.data : []);
      setPending(Array.isArray(p.data) ? p.data : []);
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

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const r = await api.get('/users/search', { params: { q: q.trim() } });
      setResults(Array.isArray(r.data) ? r.data : []);
    } catch {
      setResults([]);
    }
  };

  const sendRequest = async (userId: string) => {
    setBusyId(userId);
    try {
      await api.post(`/friends/request/${userId}`);
      Alert.alert('Request sent', 'They will see it under pending requests.');
      setQuery('');
      setResults([]);
      await load();
    } catch (e) {
      Alert.alert('Could not send request', readableError(e));
    } finally {
      setBusyId(null);
    }
  };

  const accept = async (userId: string) => {
    setBusyId(userId);
    try {
      await api.put(`/friends/accept/${userId}`);
      await load();
    } catch (e) {
      Alert.alert('Could not accept', readableError(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (userId: string, name: string) => {
    Alert.alert('Remove friend', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(userId);
          try {
            await api.delete(`/friends/${userId}`);
            await load();
          } catch (e) {
            Alert.alert('Could not remove', readableError(e));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const challenge = async (userId: string, name: string) => {
    setBusyId(userId);
    try {
      const r = await api.post('/games', {
        opponentId: userId,
        isMultiplayer: true,
      });
      navigation.navigate('Game', { gameId: r.data.id });
    } catch (e) {
      Alert.alert(`Could not challenge ${name}`, readableError(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Page>
        <Title sub="Connect with other players.">Friends</Title>
        <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
      </Page>
    );
  }

  return (
    <Page>
      <Title sub="Find opponents, accept requests, and challenge friends.">
        Friends
      </Title>
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Text style={s.section}>SEARCH PLAYERS</Text>
      <TextInput
        style={s.input}
        placeholder="Search by username…"
        placeholderTextColor={C.muted}
        value={query}
        onChangeText={search}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {results.length > 0 && (
        <View style={s.results}>
          {results.slice(0, 6).map((u) => (
            <View key={u.id} style={s.row}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{u.username[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{u.username}</Text>
                <Text style={s.meta}>{u.eloRating ?? 1200} rating</Text>
              </View>
              <Pressable
                disabled={busyId === u.id}
                onPress={() => void sendRequest(u.id)}
                style={s.action}
              >
                <Text style={s.actionText}>
                  {busyId === u.id ? '…' : 'Add'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {pending.length > 0 && (
        <>
          <Text style={s.section}>PENDING REQUESTS</Text>
          {pending.map((p) => (
            <View key={p.id || p.userId} style={s.row}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {p.username?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.username}</Text>
                <Text style={s.meta}>Wants to be friends</Text>
              </View>
              <Pressable
                disabled={busyId === p.userId}
                onPress={() => void accept(p.userId)}
                style={[s.action, { backgroundColor: C.green }]}
              >
                <Text style={[s.actionText, { color: C.bg }]}>
                  {busyId === p.userId ? '…' : 'Accept'}
                </Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      <Text style={s.section}>YOUR FRIENDS ({friends.length})</Text>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.userId}
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
            No friends yet. Search for players above and send a request.
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {item.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.username}</Text>
              <Text style={s.meta}>{item.eloRating ?? 1200} rating</Text>
            </View>
            <Pressable
              disabled={busyId === item.userId}
              onPress={() => void challenge(item.userId, item.username)}
              style={[s.action, { backgroundColor: C.green }]}
            >
              <Text style={[s.actionText, { color: C.bg }]}>
                {busyId === item.userId ? '…' : 'Play'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void remove(item.userId, item.username)}
              style={s.remove}
            >
              <Text style={{ color: C.muted, fontSize: 12 }}>✕</Text>
            </Pressable>
          </View>
        )}
      />
    </Page>
  );
}

const s = StyleSheet.create({
  section: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 10,
  },
  input: {
    backgroundColor: C.panel,
    borderColor: '#34473e',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 16,
    marginBottom: 8,
  },
  results: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.green, fontWeight: '900' },
  name: { color: C.text, fontWeight: '800' },
  meta: { color: C.muted, fontSize: 11, marginTop: 2 },
  action: {
    backgroundColor: C.panel2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionText: { color: C.green, fontWeight: '800', fontSize: 12 },
  remove: { padding: 8 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 20, lineHeight: 20 },
  error: { color: C.red, marginBottom: 10, fontSize: 13 },
});
