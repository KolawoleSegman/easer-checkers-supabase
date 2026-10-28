import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Board, Piece, PieceColor } from '../lib/board';
import { api, readableError } from '../api/client';
import { connectSocket } from '../api/socket';
import { useAuth } from '../store/auth';
import { Page, Button, C } from '../components/Screen';
import { playSound } from '../lib/sounds';
import { useVoiceCall } from '../hooks/useVoiceCall';
import VoiceCallBar from '../components/VoiceCallBar';
import type { GameState } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

export default function GameScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();
  const cell = Math.floor(Math.min(width - 40, 420) / 10);
  const prevStatus = useRef<string | null>(null);
  const prevMoveCount = useRef(0);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);
  const [liveSocket, setLiveSocket] = useState<ReturnType<typeof connectSocket> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get(`/games/${gameId}`);
      setState(r.data);
      setError('');
    } catch (e) {
      setError(readableError(e));
    }
  }, [gameId]);

  useEffect(() => {
    void refresh();
    if (!token) return;
    const socket = connectSocket(token);
    socketRef.current = socket;
    setLiveSocket(socket);
    socket.emit('join_room', { gameId });
    const onState = (s: GameState) => {
      if (s?.game?.id === gameId) {
        setState(s);
        setSelected(null);
      }
    };
    const onErr = (e: any) => setError(e?.message || 'Connection issue');
    socket.on('game_state', onState);
    socket.on('move_error', onErr);
    socket.on('player_disconnected', () =>
      Alert.alert('Opponent disconnected', 'Waiting for your opponent to reconnect.'),
    );
    return () => {
      socket.emit('leave_room', { gameId });
      socket.off('game_state', onState);
      socket.off('move_error', onErr);
      socketRef.current = null;
      setLiveSocket(null);
    };
  }, [gameId, token, refresh]);

  // Play sounds when moves arrive or game ends
  useEffect(() => {
    if (!state) return;
    const moves = state.moves || [];
    const status = state.game?.status;

    if (moves.length > prevMoveCount.current) {
      const last = moves[moves.length - 1];
      if (last?.capturedPiece) void playSound('capture');
      else void playSound('move');
    }
    prevMoveCount.current = moves.length;

    if (status && status !== 'ACTIVE' && prevStatus.current === 'ACTIVE') {
      const iWon = state.game?.winnerId === user?.id;
      if (status === 'DRAW') void playSound('move');
      else if (iWon) void playSound('win');
      else void playSound('lose');
    }
    prevStatus.current = status || null;
  }, [state, user?.id]);

  const board = useMemo(() => {
    if (!state?.board) return null;
    const b = new Board();
    b.setState(
      state.board.board as Piece[][],
      state.board.currentTurn as PieceColor,
      state.board.multiCapturePiece ?? null,
      state.board.ghosts ?? [],
    );
    return b;
  }, [state]);

  const myColor: PieceColor =
    state?.game.whiteId === user?.id ? 'white' : 'black';
  const myTurn = state?.board?.currentTurn === myColor;
  const isWaiting = state?.game?.blackId === 'WAITING';
  const isMultiplayer =
    !!state && state.game.blackId !== 'AI' && state.game.blackId !== 'WAITING';
  const bothPlayersPresent =
    isMultiplayer && state?.game?.status === 'ACTIVE';
  const opponentName =
    myColor === 'white'
      ? state?.blackUsername || 'Opponent'
      : state?.whiteUsername || 'Opponent';

  const {
    available: callAvailable,
    status: callStatus,
    isMuted,
    incoming,
    error: callError,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  } = useVoiceCall({
    socket: liveSocket,
    gameId,
    myUserId: user?.id ?? null,
    enabled: bothPlayersPresent,
  });

  // Mid-capture: the jumping piece must keep going, so keep it selected.
  useEffect(() => {
    const forced = state?.board?.multiCapturePiece;
    if (forced && myTurn && !selected) setSelected({ row: forced.row, col: forced.col });
  }, [state, myTurn, selected]);

  const legalTargets = useMemo(() => {
    if (!board || !selected || !myTurn) return [] as { row: number; col: number }[];
    return board
      .getValidMoves(myColor)
      .filter((m) => m.fromRow === selected.row && m.fromCol === selected.col)
      .map((m) => ({ row: m.toRow, col: m.toCol }));
  }, [board, selected, myTurn, myColor]);

  const tap = async (row: number, col: number) => {
    if (!board || !state || busy || state.game.status !== 'ACTIVE' || !myTurn) return;
    const grid = board.getGrid();
    const piece = grid[row][col];

    if (selected) {
      const legal = board
        .getValidMoves(myColor)
        .find(
          (m) =>
            m.fromRow === selected.row &&
            m.fromCol === selected.col &&
            m.toRow === row &&
            m.toCol === col,
        );
      if (legal) {
        setBusy(true);
        try {
          await api.post(`/games/${gameId}/move`, {
            fromRow: legal.fromRow,
            fromCol: legal.fromCol,
            toRow: legal.toRow,
            toCol: legal.toCol,
          });
          // Sound will play when refreshed state arrives
          await refresh();
        } catch (e) {
          setError(readableError(e));
        } finally {
          setBusy(false);
          setSelected(null);
        }
        return;
      }
    }

    if (piece?.color === myColor) {
      const moves = board.getValidMoves(myColor);
      if (moves.some((m) => m.fromRow === row && m.fromCol === col)) {
        setSelected({ row, col });
      } else {
        setSelected(null);
      }
    } else {
      setSelected(null);
    }
  };

  const cancelRoom = async () => {
    try {
      await api.delete(`/games/${gameId}`);
      navigation.navigate('Home');
    } catch (e) {
      Alert.alert('Could not cancel', readableError(e));
    }
  };

  if (!state) {
    return (
      <Page>
        <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
        {error ? <Text style={s.error}>{error}</Text> : null}
      </Page>
    );
  }

  const grid = board?.getGrid() || [];

  return (
    <Page>
      <View style={s.head}>
        <Pressable onPress={() => navigation.navigate('Home')}>
          <Text style={s.heading}>← LOBBY</Text>
        </Pressable>
        <Text style={s.heading}>{isWaiting ? 'WAITING' : 'MATCH'}</Text>
      </View>

      <View style={s.player}>
        <View style={[s.dot, { backgroundColor: '#f3f0e6' }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.playerName}>
            {state.whiteUsername || 'White'}
            {state.game.whiteId === user?.id ? ' (you)' : ''}
          </Text>
          <Text style={s.playerSub}>WHITE PIECES</Text>
        </View>
        <Text style={s.turn}>
          {state.board?.currentTurn === 'white' ? 'TO MOVE' : ''}
        </Text>
      </View>

      <View style={s.board}>
        {Array.from({ length: 10 }).map((_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {Array.from({ length: 10 }).map((__, c) => {
              const isDark = (r + c) % 2 === 0;
              const p = grid[r]?.[c];
              const isSelected = selected?.row === r && selected?.col === c;
              const target = legalTargets.some((t) => t.row === r && t.col === c);
              return (
                <Pressable
                  key={`${r}-${c}`}
                  onPress={() => void tap(r, c)}
                  style={{
                    width: cell,
                    height: cell,
                    backgroundColor: isDark ? '#567462' : '#e7e1d3',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: C.green,
                  }}
                >
                  {target && !p ? <View style={s.target} /> : null}
                  {p ? (
                    <View
                      style={[
                        s.piece,
                        {
                          backgroundColor:
                            p.color === 'white' ? '#f8f4e9' : '#24312c',
                          borderColor:
                            p.color === 'white' ? '#c3c0b5' : '#40554a',
                        },
                      ]}
                    >
                      {p.isKing ? (
                        <Text
                          style={{
                            color: p.color === 'white' ? '#24312c' : C.green,
                            fontWeight: '900',
                            fontSize: cell * 0.45,
                          }}
                        >
                          ♛
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={s.player}>
        <View style={[s.dot, { backgroundColor: '#27312d' }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.playerName}>
            {isWaiting ? 'Waiting for opponent…' : state.blackUsername || 'Black'}
            {state.game.blackId === user?.id ? ' (you)' : ''}
          </Text>
          <Text style={s.playerSub}>BLACK PIECES</Text>
        </View>
        <Text style={s.turn}>
          {state.board?.currentTurn === 'black' && !isWaiting ? 'TO MOVE' : ''}
        </Text>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {bothPlayersPresent ? (
        <VoiceCallBar
          available={callAvailable}
          status={callStatus}
          isMuted={isMuted}
          incoming={incoming}
          error={callError}
          opponentName={opponentName}
          onStart={startCall}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
        />
      ) : null}

      <View style={s.status}>
        <Text style={s.statusHint}>ROOM CODE: {gameId.slice(0, 8)}…</Text>
        <Text style={s.statusText}>
          {state.game.status !== 'ACTIVE'
            ? `Match ${String(state.game.status).toLowerCase().replace('_', ' ')}`
            : isWaiting
              ? 'Waiting for an opponent to join'
              : busy
                ? 'Submitting move…'
                : myTurn
                  ? 'Your turn — choose a piece'
                  : 'Opponent’s turn'}
        </Text>
        <Text style={s.statusHint}>10 × 10 · International draughts</Text>
      </View>

      {isWaiting && state.game.whiteId === user?.id ? (
        <Button title="Cancel room" secondary onPress={() => void cancelRoom()} />
      ) : null}
      {state.game.status !== 'ACTIVE' ? (
        <Button title="Back to lobby" onPress={() => navigation.navigate('Home')} />
      ) : null}
    </Page>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  heading: { color: C.text, fontWeight: '900', letterSpacing: 1.5, fontSize: 13 },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  dot: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#8da194',
  },
  playerName: { color: C.text, fontWeight: '800', fontSize: 14 },
  playerSub: { color: C.muted, fontSize: 9, letterSpacing: 1.2, marginTop: 3 },
  turn: { color: C.green, fontWeight: '900', fontSize: 10 },
  board: {
    alignSelf: 'center',
    flexDirection: 'column',
    borderWidth: 3,
    borderColor: '#2d4438',
    borderRadius: 4,
    overflow: 'hidden',
  },
  piece: {
    width: '76%',
    height: '76%',
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  target: {
    width: '28%',
    height: '28%',
    borderRadius: 20,
    backgroundColor: C.green,
    opacity: 0.9,
  },
  status: {
    backgroundColor: C.panel,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    alignItems: 'center',
  },
  statusText: { color: C.text, fontWeight: '800', fontSize: 14 },
  statusHint: { color: C.muted, fontSize: 11, marginTop: 5 },
  error: { color: C.red, marginBottom: 8, textAlign: 'center' },
});
