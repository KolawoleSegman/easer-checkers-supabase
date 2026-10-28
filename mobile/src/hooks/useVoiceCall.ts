import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ICE_SERVERS } from '../lib/iceServers';

/**
 * NOTE: react-native-webrtc requires a development build (Expo Go is not enough).
 * After adding the dependency:
 *   npx expo install react-native-webrtc
 *   npx expo prebuild
 *   eas build --profile development  (or npx expo run:android / run:ios)
 *
 * We import dynamically so the rest of the app still runs in Expo Go
 * (voice call simply stays unavailable until a dev client is used).
 */

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connected'
  | 'ended';

interface IncomingCall {
  from: string;
  fromUsername: string;
  offer: any;
}

interface UseVoiceCallOptions {
  socket: Socket | null;
  gameId: string | null;
  myUserId: string | null;
  enabled?: boolean;
}

let WebRTC: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebRTC = require('react-native-webrtc');
} catch {
  // Package not installed or running inside Expo Go
}

export function useVoiceCall({
  socket,
  gameId,
  myUserId,
  enabled = true,
}: UseVoiceCallOptions) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(!!WebRTC);

  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const statusRef = useRef<CallStatus>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t: any) => t.stop());
      } catch {}
      localStreamRef.current = null;
    }
    setIsMuted(false);
    setIncoming(null);
    setError(null);
  }, []);

  const createPeerConnection = useCallback(() => {
    if (!WebRTC) return null;
    const { RTCPeerConnection } = WebRTC;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event: any) => {
      if (event.candidate && socket && gameId) {
        socket.emit('ice_candidate', {
          gameId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event: any) => {
      // On native the remote stream is attached via RTCView
      // We store it so the UI can render <RTCView streamURL={...} />
      if (event.streams?.[0]) {
        (pc as any)._remoteStream = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setStatus('connected');
      } else if (
        state === 'failed' ||
        state === 'disconnected' ||
        state === 'closed'
      ) {
        if (
          statusRef.current === 'connected' ||
          statusRef.current === 'calling'
        ) {
          cleanup();
          setStatus('ended');
          setTimeout(() => setStatus('idle'), 1500);
        }
      }
    };

    return pc;
  }, [socket, gameId, cleanup]);

  const startCall = useCallback(async () => {
    if (!socket || !gameId || !enabled || !WebRTC) {
      if (!WebRTC) {
        setError('Voice calls need a development build (react-native-webrtc)');
      }
      return;
    }
    if (statusRef.current !== 'idle') return;

    setError(null);
    try {
      const { mediaDevices } = WebRTC;
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      if (!pc) throw new Error('PeerConnection failed');
      pcRef.current = pc;
      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      socket.emit('call_offer', { gameId, offer: pc.localDescription });
      setStatus('calling');
    } catch (err: any) {
      cleanup();
      setError(err?.message || 'Could not access microphone');
      setStatus('idle');
    }
  }, [socket, gameId, enabled, createPeerConnection, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!socket || !gameId || !incoming || !WebRTC) return;

    setError(null);
    try {
      const { mediaDevices } = WebRTC;
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      if (!pc) throw new Error('PeerConnection failed');
      pcRef.current = pc;
      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(incoming.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call_answer', { gameId, answer: pc.localDescription });
      setIncoming(null);
      setStatus('connected');
    } catch (err: any) {
      cleanup();
      setError(err?.message || 'Could not accept call');
      setStatus('idle');
    }
  }, [socket, gameId, incoming, createPeerConnection, cleanup]);

  const rejectCall = useCallback(() => {
    if (!socket || !gameId) return;
    socket.emit('call_reject', { gameId });
    setIncoming(null);
    setStatus('idle');
  }, [socket, gameId]);

  const endCall = useCallback(() => {
    if (socket && gameId) {
      socket.emit('call_end', { gameId });
    }
    cleanup();
    setStatus('ended');
    setTimeout(() => setStatus('idle'), 1200);
  }, [socket, gameId, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket || !gameId || !myUserId || !enabled) return;

    const onOffer = (data: any) => {
      if (data.from === myUserId) return;
      if (statusRef.current !== 'idle') {
        socket.emit('call_reject', { gameId });
        return;
      }
      setIncoming({
        from: data.from,
        fromUsername: data.fromUsername,
        offer: data.offer,
      });
      setStatus('ringing');
    };

    const onAnswer = async (data: any) => {
      if (data.from === myUserId) return;
      if (!pcRef.current || statusRef.current !== 'calling') return;
      try {
        await pcRef.current.setRemoteDescription(data.answer);
        setStatus('connected');
      } catch {
        cleanup();
        setStatus('idle');
        setError('Failed to connect call');
      }
    };

    const onIce = async (data: any) => {
      if (data.from === myUserId || !pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(data.candidate);
      } catch {
        // ignore
      }
    };

    const onEnd = (data: any) => {
      if (data.from === myUserId) return;
      cleanup();
      setStatus('ended');
      setTimeout(() => setStatus('idle'), 1200);
    };

    const onReject = (data: any) => {
      if (data.from === myUserId) return;
      cleanup();
      setStatus('idle');
      setError('Call was declined');
      setTimeout(() => setError(null), 3000);
    };

    const onPlayerLeft = (data: any) => {
      if (data.userId === myUserId) return;
      if (
        statusRef.current === 'connected' ||
        statusRef.current === 'calling' ||
        statusRef.current === 'ringing'
      ) {
        cleanup();
        setStatus('ended');
        setTimeout(() => setStatus('idle'), 1200);
      }
    };

    socket.on('call_offer', onOffer);
    socket.on('call_answer', onAnswer);
    socket.on('ice_candidate', onIce);
    socket.on('call_end', onEnd);
    socket.on('call_reject', onReject);
    socket.on('player_disconnected', onPlayerLeft);

    return () => {
      socket.off('call_offer', onOffer);
      socket.off('call_answer', onAnswer);
      socket.off('ice_candidate', onIce);
      socket.off('call_end', onEnd);
      socket.off('call_reject', onReject);
      socket.off('player_disconnected', onPlayerLeft);
    };
  }, [socket, gameId, myUserId, enabled, cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (
      !enabled &&
      (status === 'connected' || status === 'calling' || status === 'ringing')
    ) {
      endCall();
    }
  }, [enabled, status, endCall]);

  return {
    available,
    status,
    isMuted,
    incoming,
    error,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    /** Remote MediaStream (for RTCView if you want to show something) */
    getRemoteStream: () => (pcRef.current as any)?._remoteStream ?? null,
  };
}
