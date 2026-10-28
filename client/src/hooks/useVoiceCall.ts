import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ICE_SERVERS } from "../lib/iceServers";

export type CallStatus =
  | "idle"
  | "calling"      // we started the call, waiting for answer
  | "ringing"      // someone is calling us
  | "connected"
  | "ended";

interface IncomingCall {
  from: string;
  fromUsername: string;
  offer: RTCSessionDescriptionInit;
}

interface UseVoiceCallOptions {
  socket: Socket | null;
  gameId: string | null;
  myUserId: string | null;
  /** Only allow calls when both players are present */
  enabled?: boolean;
}

/**
 * Production-ready WebRTC voice call hook.
 * Uses the existing Socket.IO connection only for signaling.
 * Audio travels peer-to-peer.
 */
export function useVoiceCall({
  socket,
  gameId,
  myUserId,
  enabled = true,
}: UseVoiceCallOptions) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const statusRef = useRef<CallStatus>("idle");

  // Keep statusRef in sync so event handlers always see latest value
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setIsMuted(false);
    setIncoming(null);
    setError(null);
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && gameId) {
        socket.emit("ice_candidate", {
          gameId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        // Some browsers need an explicit play() after user gesture
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setStatus("connected");
      } else if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        if (statusRef.current === "connected" || statusRef.current === "calling") {
          cleanup();
          setStatus("ended");
          // Reset to idle after a short moment so UI can show "ended"
          setTimeout(() => setStatus("idle"), 1500);
        }
      }
    };

    return pc;
  }, [socket, gameId, cleanup]);

  // ---------- Public actions ----------

  const startCall = useCallback(async () => {
    if (!socket || !gameId || !enabled) return;
    if (statusRef.current !== "idle") return;

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call_offer", { gameId, offer });
      setStatus("calling");
    } catch (err: any) {
      cleanup();
      const msg =
        err?.name === "NotAllowedError"
          ? "Microphone permission denied"
          : "Could not access microphone";
      setError(msg);
      setStatus("idle");
    }
  }, [socket, gameId, enabled, createPeerConnection, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!socket || !gameId || !incoming) return;

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(incoming.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call_answer", { gameId, answer });
      setIncoming(null);
      setStatus("connected");
    } catch (err: any) {
      cleanup();
      const msg =
        err?.name === "NotAllowedError"
          ? "Microphone permission denied"
          : "Could not accept call";
      setError(msg);
      setStatus("idle");
    }
  }, [socket, gameId, incoming, createPeerConnection, cleanup]);

  const rejectCall = useCallback(() => {
    if (!socket || !gameId) return;
    socket.emit("call_reject", { gameId });
    setIncoming(null);
    setStatus("idle");
  }, [socket, gameId]);

  const endCall = useCallback(() => {
    if (socket && gameId) {
      socket.emit("call_end", { gameId });
    }
    cleanup();
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 1200);
  }, [socket, gameId, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }, []);

  // ---------- Socket listeners ----------
  useEffect(() => {
    if (!socket || !gameId || !myUserId || !enabled) return;

    const onOffer = (data: {
      from: string;
      fromUsername: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (data.from === myUserId) return;
      // Only accept if we are idle
      if (statusRef.current !== "idle") {
        // Busy — auto reject
        socket.emit("call_reject", { gameId });
        return;
      }
      setIncoming({
        from: data.from,
        fromUsername: data.fromUsername,
        offer: data.offer,
      });
      setStatus("ringing");
    };

    const onAnswer = async (data: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (data.from === myUserId) return;
      if (!pcRef.current || statusRef.current !== "calling") return;
      try {
        await pcRef.current.setRemoteDescription(data.answer);
        setStatus("connected");
      } catch {
        cleanup();
        setStatus("idle");
        setError("Failed to connect call");
      }
    };

    const onIce = async (data: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (data.from === myUserId || !pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(data.candidate);
      } catch {
        // Ignore late / invalid candidates
      }
    };

    const onEnd = (data: { from: string }) => {
      if (data.from === myUserId) return;
      cleanup();
      setStatus("ended");
      setTimeout(() => setStatus("idle"), 1200);
    };

    const onReject = (data: { from: string }) => {
      if (data.from === myUserId) return;
      cleanup();
      setStatus("idle");
      setError("Call was declined");
      setTimeout(() => setError(null), 3000);
    };

    const onPlayerLeft = (data: { userId: string }) => {
      if (data.userId === myUserId) return;
      // Opponent left the room — hang up
      if (statusRef.current === "connected" || statusRef.current === "calling" || statusRef.current === "ringing") {
        cleanup();
        setStatus("ended");
        setTimeout(() => setStatus("idle"), 1200);
      }
    };

    socket.on("call_offer", onOffer);
    socket.on("call_answer", onAnswer);
    socket.on("ice_candidate", onIce);
    socket.on("call_end", onEnd);
    socket.on("call_reject", onReject);
    socket.on("player_disconnected", onPlayerLeft);

    return () => {
      socket.off("call_offer", onOffer);
      socket.off("call_answer", onAnswer);
      socket.off("ice_candidate", onIce);
      socket.off("call_end", onEnd);
      socket.off("call_reject", onReject);
      socket.off("player_disconnected", onPlayerLeft);
    };
  }, [socket, gameId, myUserId, enabled, cleanup]);

  // Cleanup when game ends or component unmounts
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Auto-end call if game is no longer active (caller can pass enabled=false)
  useEffect(() => {
    if (!enabled && (status === "connected" || status === "calling" || status === "ringing")) {
      endCall();
    }
  }, [enabled, status, endCall]);

  return {
    status,
    isMuted,
    incoming,
    error,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    remoteAudioRef, // attach to <audio ref={remoteAudioRef} autoPlay playsInline />
  };
}
