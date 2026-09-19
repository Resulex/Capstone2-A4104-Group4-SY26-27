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

// A production build without API_BACKEND_URL bakes http://localhost:3000 into
// both the rewrites below and the `env` block above — every deployed
// /api/backend/* call would then hit the Next server itself and answer
// "Empty response from backend." (which is exactly what happened on Amplify,
// 2026-09-12). Warn here, where it is still cheap to fix.
if (process.env.NODE_ENV === "production" && !process.env.API_BACKEND_URL) {
  console.warn(
    "[next.config] API_BACKEND_URL is not set — this build will proxy the backend to " +
      "http://localhost:3000. Set it on the hosting platform before deploying.",
  );
}

/**
 * Base URL of the backend WebSocket server. Must match
 * `custom.serverless-offline.websocketPort` in backend/serverless.yml
 * (`npm --prefix backend run verify:routes` fails on a mismatch).
 */
const API_WEBSOCKET_URL = process.env.API_WEBSOCKET_URL ?? "ws://localhost:3001";

/**
 * URL the browser actually dials. Read directly by
 * `src/hooks/useWebSocket.ts`; only referenced here so it stays visible and so
 * a production build can warn when it is missing.
 */
const NEXT_PUBLIC_WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

// A production build without NEXT_PUBLIC_WEBSOCKET_URL inlines the
// `ws://localhost:3001` fallback from `src/hooks/useWebSocket.ts`, so every
// visitor's browser dials its OWN machine: the socket can never connect and the
// console silently degrades to the polling fallback (late, and with no toast or
// chime on the admin side for polled items). That is exactly what shipped on
// Amplify and went unnoticed for weeks, because members of staff do not read
// the browser console. Next inlines `NEXT_PUBLIC_*` at BUILD time, so this must
// be set on the hosting platform before the build — not at request time.
if (process.env.NODE_ENV === "production" && !NEXT_PUBLIC_WEBSOCKET_URL) {
  console.warn(
    "[next.config] NEXT_PUBLIC_WEBSOCKET_URL is not set — this build will make the " +
      "browser dial ws://localhost:3001, so real-time notifications will never arrive " +
      "(the UI falls back to 8s polling). Set it on the hosting platform before deploying.",
  );
}

// Still referenced so the local/offline key stays documented next to the public
// one it has to match (`custom.serverless-offline.websocketPort`).
void API_WEBSOCKET_URL;

const nextConfig: NextConfig = {
  // Inline the backend location at BUILD time.
  //
  // The route handlers under `src/app/api/**` (the `/api/backend/[...path]`
  // cookie→Bearer proxy and `lib/session-guard.ts`) read these two values while
  // serving a request. Amplify Hosting gives the branch environment variables to
  // the build but not to the SSR compute, so those runtime lookups fell through
  // to the `http://localhost:3000` default — the SSR server calling itself —
  // and every `/api/backend/*` request answered 404 "Empty response from
  // backend." The `rewrites()` below were unaffected because Next resolves them
  // at build time, which is why only part of the app broke.
  //
  // `env` makes Next substitute the literals into the bundle, so request-time
  // code uses the same values the rewrites already use. Neither value is a
  // secret (a public API URL and a stage name).
  //
  // Consequence: these are fixed per build. Changing them on the hosting
  // platform requires a new frontend build, exactly like the rewrites.
  env: {
    API_BACKEND_URL,
    API_BACKEND_STAGE,
  },
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
