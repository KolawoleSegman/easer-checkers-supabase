import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { CallStatus } from '../hooks/useVoiceCall';
import { C } from './Screen';

interface Props {
  available: boolean;
  status: CallStatus;
  isMuted: boolean;
  incoming: { fromUsername: string } | null;
  error: string | null;
  opponentName?: string;
  onStart: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

/**
 * Compact voice-call controls that sit above the board status on mobile.
 */
export default function VoiceCallBar({
  available,
  status,
  isMuted,
  incoming,
  error,
  opponentName = 'Opponent',
  onStart,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
}: Props) {
  if (!available) {
    return (
      <View style={s.box}>
        <Text style={s.hint}>
          Voice calls need a development build (react-native-webrtc)
        </Text>
      </View>
    );
  }

  if (status === 'idle') {
    return (
      <View style={s.box}>
        <Pressable style={s.primary} onPress={onStart}>
          <Text style={s.primaryText}>📞  Start Voice Call</Text>
        </Pressable>
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
    );
  }

  if (status === 'ringing' && incoming) {
    return (
      <View style={[s.box, s.ringing]}>
        <Text style={s.title}>Incoming call</Text>
        <Text style={s.sub}>{incoming.fromUsername} is calling…</Text>
        <View style={s.row}>
          <Pressable style={[s.btn, s.accept]} onPress={onAccept}>
            <Text style={s.btnText}>Accept</Text>
          </Pressable>
          <Pressable style={[s.btn, s.decline]} onPress={onReject}>
            <Text style={s.btnText}>Decline</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (status === 'calling') {
    return (
      <View style={s.box}>
        <ActivityIndicator color={C.green} style={{ marginBottom: 8 }} />
        <Text style={s.title}>Calling {opponentName}…</Text>
        <Pressable style={[s.btn, s.decline, { marginTop: 12 }]} onPress={onEnd}>
          <Text style={s.btnText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'connected') {
    return (
      <View style={[s.box, s.live]}>
        <Text style={s.liveLabel}>● Live with {opponentName}</Text>
        <View style={s.row}>
          <Pressable
            style={[s.btn, isMuted ? s.muted : s.secondary]}
            onPress={onToggleMute}
          >
            <Text style={s.btnText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </Pressable>
          <Pressable style={[s.btn, s.decline]} onPress={onEnd}>
            <Text style={s.btnText}>End Call</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ended
  return (
    <View style={s.box}>
      <Text style={s.hint}>Call ended</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: C.panel,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  ringing: {
    borderWidth: 1,
    borderColor: C.green,
  },
  live: {
    borderWidth: 1,
    borderColor: 'rgba(46, 160, 100, 0.45)',
  },
  title: { color: C.text, fontWeight: '800', fontSize: 15 },
  sub: { color: C.muted, fontSize: 13, marginTop: 4, marginBottom: 12 },
  liveLabel: {
    color: C.green,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  primary: {
    backgroundColor: '#1e7a4a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    width: '100%',
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  accept: { backgroundColor: '#1e7a4a' },
  decline: { backgroundColor: '#9b2c2c' },
  secondary: { backgroundColor: 'rgba(255,255,255,0.1)' },
  muted: { backgroundColor: '#b45309' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error: { color: C.red, marginTop: 8, fontSize: 12, textAlign: 'center' },
  hint: { color: C.muted, fontSize: 12, textAlign: 'center' },
});
