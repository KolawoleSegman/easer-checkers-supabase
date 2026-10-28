/**
 * Shared ICE servers for WebRTC voice calls (mobile).
 * Keep in sync with client/src/lib/iceServers.ts
 *
 * Add TURN credentials from Metered / Twilio / your own coturn for
 * reliable mobile-data connectivity.
 */
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Example TURN (fill in real credentials):
  // {
  //   urls: 'turn:openrelay.metered.ca:80',
  //   username: 'YOUR_USERNAME',
  //   credential: 'YOUR_CREDENTIAL',
  // },
];
