import type { NextConfig } from "next";

/**
 * Base URL of the serverless backend. Override via the API_BACKEND_URL env
 * var; with `serverless offline` it runs on http://localhost:3000.
 */
const API_BACKEND_URL = process.env.API_BACKEND_URL ?? "http://localhost:3000";

/**
 * Stage prefix used by `serverless offline` (e.g. `/dev`). Override via the
 * API_BACKEND_STAGE env var.
 */
const API_BACKEND_STAGE = process.env.API_BACKEND_STAGE ?? "dev";

/**
 * Base URL of the backend WebSocket server. Must match
 * `custom.serverless-offline.websocketPort` in backend/serverless.yml
 * (`npm --prefix backend run verify:routes` fails on a mismatch).
 */
const API_WEBSOCKET_URL = process.env.API_WEBSOCKET_URL ?? "ws://localhost:3001";

// The browser bundle reads NEXT_PUBLIC_WEBSOCKET_URL directly (see
// src/hooks/useWebSocket.ts); referenced here so both keys stay documented and
// visible to the Next.js env loader.
void API_WEBSOCKET_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Allow remote media (S3 uploads, Google profile images) through the
      // image optimizer; content is admin-curated barangay media.
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      // Proxy the backend auth routes so the frontend can call relative
      // `/api/...` paths (no CORS needed).
      {
        source: "/api/auth/admin/:path*",
        destination: `${API_BACKEND_URL}/${API_BACKEND_STAGE}/auth/admin/:path*`,
      },
      {
        source: "/api/auth/resident/:path*",
        destination: `${API_BACKEND_URL}/${API_BACKEND_STAGE}/auth/resident/:path*`,
      },
    ];
  },
};

export default nextConfig;
