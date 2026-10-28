import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { Page, Title, Button, C } from '../components/Screen';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { areSoundsEnabled, setSoundsEnabled } from '../lib/sounds';

export default function ProfileScreen() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [soundsOn, setSoundsOn] = useState(areSoundsEnabled());

  useEffect(() => {
    api.get('/profile').then((r) => setProfile(r.data)).catch(() => {});
    api.get('/users/me/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <Page>
      <ScrollView>
        <Title sub="Your player identity and match record.">Profile</Title>
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={{ fontSize: 30, color: C.green, fontWeight: '900' }}>
              {(user?.username || 'P')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={s.name}>{profile?.username || user?.username || 'Player'}</Text>
          <Text style={s.email}>{profile?.email || user?.email}</Text>
          <Text style={s.rating}>
            {stats?.eloRating ?? profile?.eloRating ?? 1200}{' '}
            <Text style={s.ratingLabel}>RATING</Text>
          </Text>
        </View>
        <View style={s.stats}>
          <Metric label="WINS" value={stats?.wins} />
          <Metric label="LOSSES" value={stats?.losses} />
          <Metric label="DRAWS" value={stats?.draws} />
        </View>
        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Sound effects</Text>
          <Switch
            value={soundsOn}
            onValueChange={(v) => {
              setSoundsOn(v);
              setSoundsEnabled(v);
            }}
            trackColor={{ false: C.panel2, true: C.green }}
            thumbColor="#fff"
          />
        </View>
        <Button
          title="Sign out"
          secondary
          onPress={() =>
            Alert.alert('Sign out', 'Sign out of Easer Checkers?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
            ])
          }
        />
      </ScrollView>
    </Page>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.panel, padding: 14, borderRadius: 14 }}>
      <Text style={{ color: C.text, fontSize: 23, fontWeight: '900' }}>{value ?? '—'}</Text>
      <Text style={{ color: C.muted, fontSize: 9, letterSpacing: 1.2, marginTop: 5 }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 22,
    padding: 24,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: C.panel2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  name: { color: C.text, fontSize: 22, fontWeight: '900' },
  email: { color: C.muted, marginTop: 6 },
  rating: { color: C.green, fontSize: 25, fontWeight: '900', marginTop: 20 },
  ratingLabel: { fontSize: 10, letterSpacing: 1.4 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.panel,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  toggleLabel: { color: C.text, fontWeight: '700' },
});
