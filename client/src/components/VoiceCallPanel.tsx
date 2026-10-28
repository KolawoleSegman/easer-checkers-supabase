import { useEffect } from "react";
import type { CallStatus } from "../hooks/useVoiceCall";

interface VoiceCallPanelProps {
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
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
}

/**
 * Compact, polished voice-call UI that sits above the chat panel.
 * Designed to match the existing glass / dark theme of the game page.
 */
export default function VoiceCallPanel({
  status,
  isMuted,
  incoming,
  error,
  opponentName = "Opponent",
  onStart,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  remoteAudioRef,
}: VoiceCallPanelProps) {
  // Simple ring tone while someone is calling us
  useEffect(() => {
    if (status === "ringing") {
      // Create a short repeating beep using Web Audio if no asset exists
      // (keeps the feature self-contained)
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        let stopped = false;
        const beep = () => {
          if (stopped) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
          setTimeout(beep, 1200);
        };
        beep();
        return () => {
          stopped = true;
          ctx.close().catch(() => {});
        };
      } catch {
        // ignore
      }
    }
  }, [status]);

  // Hidden audio element for the remote stream
  const audioEl = (
    <audio ref={remoteAudioRef as any} autoPlay playsInline className="hidden" />
  );

  // ---------- Idle ----------
  if (status === "idle") {
    return (
      <div className="glass p-3 mb-3">
        {audioEl}
        <button
          onClick={onStart}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                     bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium
                     transition active:scale-[0.98]"
        >
          <span className="text-lg">📞</span>
          <span>Start Voice Call</span>
        </button>
        {error && (
          <p className="text-red-300 text-xs text-center mt-2">{error}</p>
        )}
      </div>
    );
  }

  // ---------- Ringing (incoming) ----------
  if (status === "ringing" && incoming) {
    return (
      <div className="glass p-4 mb-3 border border-emerald-500/40 animate-pulse">
        {audioEl}
        <p className="text-center text-white font-semibold mb-1">
          Incoming call
        </p>
        <p className="text-center text-emerald-300 text-sm mb-4">
          {incoming.fromUsername} is calling…
        </p>
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                       text-white font-medium transition"
          >
            Accept
          </button>
          <button
            onClick={onReject}
            className="flex-1 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500
                       text-white font-medium transition"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  // ---------- Calling (outgoing) ----------
  if (status === "calling") {
    return (
      <div className="glass p-4 mb-3">
        {audioEl}
        <p className="text-center text-white font-medium mb-1">
          Calling {opponentName}…
        </p>
        <p className="text-center text-gray-400 text-xs mb-4">
          Waiting for them to answer
        </p>
        <button
          onClick={onEnd}
          className="w-full py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500
                     text-white font-medium transition"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ---------- Connected ----------
  if (status === "connected") {
    return (
      <div className="glass p-4 mb-3 border border-emerald-500/30">
        {audioEl}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className="text-emerald-300 text-sm font-medium">
            Live with {opponentName}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onToggleMute}
            className={`flex-1 py-2.5 rounded-xl font-medium transition
              ${
                isMuted
                  ? "bg-yellow-600/90 hover:bg-yellow-500 text-white"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={onEnd}
            className="flex-1 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500
                       text-white font-medium transition"
          >
            End Call
          </button>
        </div>
      </div>
    );
  }

  // ---------- Ended (brief feedback) ----------
  return (
    <div className="glass p-3 mb-3">
      {audioEl}
      <p className="text-center text-gray-400 text-sm">Call ended</p>
    </div>
  );
}
