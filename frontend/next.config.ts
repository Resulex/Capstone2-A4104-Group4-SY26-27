import type { NextConfig } from "next";

/**
 * Base URL of the serverless backend. Override via the API_BACKEND_URL env
 * var; with `serverless offline` it runs on http://localhost:3001.
 */
const API_BACKEND_URL = process.env.API_BACKEND_URL ?? "http://localhost:3001";

/**
 * Stage prefix used by `serverless offline` (e.g. `/dev`). Override via the
 * API_BACKEND_STAGE env var.
 */
const API_BACKEND_STAGE = process.env.API_BACKEND_STAGE ?? "dev";

/**
 * Base URL of the backend WebSocket server. Override via the
 * API_WEBSOCKET_URL env var; it runs on ws://localhost:3002.
 */
const API_WEBSOCKET_URL = process.env.API_WEBSOCKET_URL ?? "ws://localhost:3002";

// Referenced here so the env key is validated/available at build time and
// documented for future WebSocket wiring (see src/lib/api.ts).
void API_WEBSOCKET_URL;

const nextConfig: NextConfig = {
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
