/**
 * Shared ICE servers for WebRTC voice calls.
 *
 * STUN is free and works on most home networks.
 * TURN is required for many mobile / corporate / symmetric-NAT networks.
 *
 * To add a free or paid TURN provider:
 * 1. Sign up at https://www.metered.ca/tools/openrelay/  (free tier)
 *    or Twilio / Xirsys / your own coturn server.
 * 2. Replace the placeholder TURN entries below with the credentials they give you.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  // Public Google STUN (always keep these)
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },

  // --- TURN (uncomment & fill after you get credentials) ---
  // {
  //   urls: "turn:openrelay.metered.ca:80",
  //   username: "YOUR_USERNAME",
  //   credential: "YOUR_CREDENTIAL",
  // },
  // {
  //   urls: "turn:openrelay.metered.ca:443",
  //   username: "YOUR_USERNAME",
  //   credential: "YOUR_CREDENTIAL",
  // },
  // {
  //   urls: "turn:openrelay.metered.ca:443?transport=tcp",
  //   username: "YOUR_USERNAME",
  //   credential: "YOUR_CREDENTIAL",
  // },
];
