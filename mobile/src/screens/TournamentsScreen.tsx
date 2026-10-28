import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Page, Title, Button, C } from '../components/Screen';
import { api, readableError } from '../api/client';
import { useAuth } from '../store/auth';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tournaments'>;

type Tournament = {
  id: string;
  name: string;
  description?: string;
  status: string;
  maxPlayers?: number;
  playerCount?: number;
  createdBy?: string;
  createdAt?: string;
};

export default function TournamentsScreen({ navigation }: Props) {
  const user = useAuth((s) => s.user);
  const [list, setList] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('8');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const r = await api.get('/tournaments');
      setList(Array.isArray(r.data) ? r.data : []);
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

  const create = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Name required', 'Give your tournament a name.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.post('/tournaments', {
        name: name.trim(),
        description: desc.trim(),
        maxPlayers: Math.min(64, Math.max(2, parseInt(maxPlayers, 10) || 8)),
      });
      setModal(false);
      setName('');
      setDesc('');
      setMaxPlayers('8');
      navigation.navigate('TournamentDetail', { id: r.data.id });
      await load();
    } catch (e) {
      Alert.alert('Could not create', readableError(e));
    } finally {
      setBusy(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'WAITING') return C.green;
    if (status === 'ACTIVE') return '#f0c14b';
    return C.muted;
  };

  const renderItem = ({ item }: { item: Tournament }) => (
    <Pressable
      style={s.card}
      onPress={() => navigation.navigate('TournamentDetail', { id: item.id })}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{item.name}</Text>
        <Text style={s.meta}>
          {item.playerCount ?? 0}/{item.maxPlayers ?? 8} players
          {item.description ? ` · ${item.description.slice(0, 40)}` : ''}
        </Text>
      </View>
      <Text style={[s.badge, { color: statusColor(item.status) }]}>
        {item.status}
      </Text>
    </Pressable>
  );

  return (
    <Page>
      <Title sub="Compete in brackets and climb the ranks.">Tournaments</Title>
      <Button title="Create tournament" onPress={() => setModal(true)} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 12 }}
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
              No tournaments yet. Create one and invite friends to join.
            </Text>
          }
        />
      )}

      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>New tournament</Text>
            <TextInput
              style={s.input}
              placeholder="Name"
              placeholderTextColor={C.muted}
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            <TextInput
              style={[s.input, { height: 72 }]}
              placeholder="Description (optional)"
              placeholderTextColor={C.muted}
              value={desc}
              onChangeText={setDesc}
              multiline
              maxLength={300}
            />
            <TextInput
              style={s.input}
              placeholder="Max players (2–64)"
              placeholderTextColor={C.muted}
              value={maxPlayers}
              onChangeText={setMaxPlayers}
              keyboardType="number-pad"
            />
            <Button title={busy ? 'Creating…' : 'Create'} onPress={() => void create()} disabled={busy} />
            <Button title="Cancel" secondary onPress={() => setModal(false)} />
          </View>
        </View>
      </Modal>
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
  name: { color: C.text, fontWeight: '800', fontSize: 16 },
  meta: { color: C.muted, fontSize: 11, marginTop: 4 },
  badge: { fontWeight: '900', fontSize: 11, letterSpacing: 0.6 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40, lineHeight: 22 },
  error: { color: C.red, marginTop: 10, fontSize: 13 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    paddingBottom: 36,
  },
  modalTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 16,
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
    marginBottom: 12,
  },
});
