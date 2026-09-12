#!/usr/bin/env node
/**
 * Route parity guard (kaBarangayConnect backend).
 *
 * Why this exists
 * ---------------
 * `serverless.yml` is the ONLY place HTTP routes are registered, and a missing
 * route is not a compile error — the frontend just gets
 * `Serverless-offline: route not found.` / a 404 from API Gateway. This has
 * bitten the admin MFA flow twice (the Cognito challenge routes were lost from
 * the working tree and never committed), so the checks below run automatically
 * via npm `prebuild` / `predeploy` hooks.
 *
 * Checks
 * ------
 * 1. `serverless.yml` parses.
 * 2. Every `handler: <module>.<export>` points at a file that exists and
 *    actually exports that symbol (catches renamed handlers).
 * 3. No duplicate `METHOD path` events (catches copy-pasted blocks).
 * 4. Every entry in REQUIRED_ROUTES is declared (the auth surface contract).
 * 5. Two-way parity with the frontend: every `/api/auth/...` literal the
 *    frontend calls is declared AND listed in REQUIRED_ROUTES, so the list
 *    above cannot silently go stale.
 * 6. WebSocket surface: `$connect`/`$disconnect`/`$default` are declared (a
 *    service with zero `websocket` events makes serverless-offline start NO
 *    websocket server), `WEBSOCKET_ENDPOINT` exists in the provider env, and
 *    offline's `websocketPort` matches the frontend's
 *    `NEXT_PUBLIC_WEBSOCKET_URL`. The old mismatch pointed the browser at
 *    `lambdaPort` 3002 (an HTTP invoke endpoint) and every handshake 404'd.
 *    A loopback `WEBSOCKET_ENDPOINT` in `backend/.env` is reported as a
 *    warning (it is right for offline, wrong for a deploy).
 * 7. Cognito IAM parity: every `*Command` that `src/shared/cognito.ts` imports
 *    from the Cognito IDP SDK is granted to the Lambda execution role, and
 *    `provider.environment` declares `COGNITO_CLIENT_SECRET`. Neither failure
 *    is a compile error nor a deploy error — the deployed admin login just
 *    answers 500 "Authentication service error." (AccessDenied on
 *    `AdminInitiateAuth`, 2026-09-12) or silently drops SECRET_HASH.
 *
 * It also warns when `backend/.env` holds values that are right for offline dev
 * but get baked into the stage by a developer-machine `npm run deploy`
 * (`COGNITO_OFFLINE=true`, loopback `WEBSOCKET_ENDPOINT` / `APP_BASE_URL` /
 * `GOOGLE_REDIRECT_URI`) — the pipeline overrides all of them.
 *
 * Usage: npm run verify:routes   (also runs before build/deploy)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(backendRoot, '..');
const configPath = path.join(backendRoot, 'serverless.yml');
const frontendSrc = path.join(repoRoot, 'frontend', 'src');

/**
 * Routes that MUST exist in `serverless.yml`. These are the auth-surface
 * endpoints the frontend (or the Cognito round-trip) depends on; they are
 * public/cookie-authenticated, so `auth: false` documents the intent.
 */
const REQUIRED_ROUTES = [
  // --- Admin login: password → TOTP challenge → session JWT (Cognito) ---
  { method: 'post', path: 'auth/admin/login', auth: false, why: 'admin login step 1 (password)' },
  { method: 'post', path: 'auth/admin/login/mfa', auth: false, why: 'admin login step 2 (TOTP code)' },
  { method: 'post', path: 'auth/admin/login/totp/setup', auth: false, why: 'admin first-login TOTP enrollment (QR)' },
  { method: 'post', path: 'auth/admin/login/totp/verify', auth: false, why: 'admin first-login TOTP enrollment (verify)' },
  { method: 'post', path: 'auth/admin/login/new-password', auth: false, why: 'admin first-login password change (temp password)' },
  { method: 'post', path: 'auth/admin/forgot-password', auth: false, why: 'admin password reset (request code)' },
  { method: 'post', path: 'auth/admin/forgot-password/confirm', auth: false, why: 'admin password reset (confirm)' },
  { method: 'get', path: 'auth/admin/ws-token', auth: false, why: 'admin WebSocket token (cookie-auth)' },
  { method: 'patch', path: 'auth/admin/password', auth: true, why: 'admin self-service password change (current + new password)' },
  // --- Resident auth ---
  { method: 'get', path: 'auth/resident/ws-token', auth: false, why: 'resident WebSocket token (cookie-auth)' },
  { method: 'get', path: 'auth/resident/google', auth: false, why: 'resident Google SSO start' },
  { method: 'get', path: 'auth/resident/google/callback', auth: false, why: 'resident Google SSO callback' },
  // --- Session validity (proves the cookie's JWT is still valid) ---
  { method: 'get', path: 'auth/session', auth: true, why: 'session validity + authoritative role check' },
  { method: 'post', path: 'auth/login', auth: false, why: 'resident password login' },
  { method: 'post', path: 'auth/register', auth: false, why: 'resident registration' },
  // --- Legacy rollback-only custom TOTP (protected) ---
  { method: 'post', path: 'auth/admin/totp/setup', auth: true, why: 'legacy otplib TOTP enrollment (rollback only)' },
  { method: 'post', path: 'auth/admin/totp/verify', auth: true, why: 'legacy otplib TOTP verify (rollback only)' },
  // --- Caller-scoped notification feeds (admin bell/badge + resident center) ---
  // These handler files existed while their route blocks were missing, so the
  // whole notification panel 404'd with no compile error — keep them pinned.
  { method: 'get', path: 'notifications/mine', auth: true, why: 'caller-scoped notification feed (admin bell + resident center)' },
  { method: 'patch', path: 'notifications/read-all', auth: true, why: "mark all of the caller's notifications read" },
  { method: 'patch', path: 'notifications/read-by-reference', auth: true, why: 'mark a queue row seen/unseen in one call (admin unread rows)' },
];

/**
 * WebSocket routes that MUST exist in `serverless.yml`. These are the only
 * thing that makes serverless-offline start a WS listener (and the only thing
 * that creates the deployed WebSocket API), so a missing block is not a
 * compile error — it is a permanently failing handshake. Keep pinned.
 */
const REQUIRED_WEBSOCKET_ROUTES = [
  { route: '$connect', fn: 'ws-connect', why: 'registers a live admin/resident connection (token auth in-handler)' },
  { route: '$disconnect', fn: 'ws-disconnect', why: 'removes the closed connection so pushes stop targeting it' },
  { route: '$default', fn: 'ws-default', why: 'keeps the socket alive (inbound messages are unused)' },
];

/** `/api/auth/*` literals served by Next.js itself (not the serverless API). */
const FRONTEND_LOCAL_ROUTES = new Set(['auth/me', 'auth/callback', 'auth/logout']);

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

// ---------------------------------------------------------------------------
// 1. Parse the service definition
// ---------------------------------------------------------------------------
let service;
try {
  service = yaml.load(readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error(`\u2716 Could not parse serverless.yml: ${err.message}`);
  process.exit(1);
}

const functions = service?.functions ?? {};
if (Object.keys(functions).length === 0) {
  console.error('\u2716 serverless.yml declares no functions.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2 + 3. Collect routes, validate handlers, detect duplicates
// ---------------------------------------------------------------------------
/** @type {{ method: string, path: string, fn: string, auth: boolean }[]} */
const httpRoutes = [];
const seen = new Map();
/** @type {{ route: string, fn: string }[]} */
const wsRoutes = [];
const seenWs = new Map();

for (const [fnName, def] of Object.entries(functions)) {
  const handlerRef = typeof def?.handler === 'string' ? def.handler : null;

  if (handlerRef) {
    const lastDot = handlerRef.lastIndexOf('.');
    const modulePath = lastDot === -1 ? handlerRef : handlerRef.slice(0, lastDot);
    const exportName = lastDot === -1 ? 'handler' : handlerRef.slice(lastDot + 1);
    const candidates = ['.ts', '.js', '.mjs'].map((ext) => path.join(backendRoot, `${modulePath}${ext}`));
    const sourceFile = candidates.find((candidate) => existsSync(candidate));

    if (!sourceFile) {
      fail(`function "${fnName}": handler file not found -> ${modulePath}.ts`);
    } else {
      const source = readFileSync(sourceFile, 'utf8');
      const exportPatterns = [
        new RegExp(`export\\s+(?:const|let|var|async\\s+function|function|class)\\s+${exportName}\\b`),
        new RegExp(`export\\s*\\{[^}]*\\b${exportName}\\b[^}]*\\}`),
      ];
      if (!exportPatterns.some((pattern) => pattern.test(source))) {
        fail(`function "${fnName}": ${modulePath}.ts does not export "${exportName}"`);
      }
    }
  }

  const events = Array.isArray(def?.events) ? def.events : [];
  for (const event of events) {
    const http = event?.http;
    if (http?.path && http?.method) {
      const method = String(http.method).toLowerCase();
      const routePath = String(http.path).replace(/^\/+/, '').replace(/\/+$/, '');
      const key = `${method} ${routePath}`;

      if (seen.has(key)) {
        fail(`duplicate route "${key}" declared by both "${seen.get(key)}" and "${fnName}"`);
      }
      seen.set(key, fnName);

      httpRoutes.push({ method, path: routePath, fn: fnName, auth: Boolean(http.authorizer) });
      continue;
    }

    const websocket = event?.websocket;
    if (!websocket?.route) continue;

    const route = String(websocket.route);
    if (seenWs.has(route)) {
      fail(`duplicate websocket route "${route}" declared by both "${seenWs.get(route)}" and "${fnName}"`);
    }
    seenWs.set(route, fnName);
    wsRoutes.push({ route, fn: fnName });
  }
}

// ---------------------------------------------------------------------------
// 4. Required routes must be declared
// ---------------------------------------------------------------------------
const declared = new Map(httpRoutes.map((route) => [`${route.method} ${route.path}`, route]));

for (const required of REQUIRED_ROUTES) {
  const key = `${required.method} ${required.path}`;
  const route = declared.get(key);
  if (!route) {
    fail(`MISSING ROUTE: ${required.method.toUpperCase()} ${required.path}  (${required.why})`);
    continue;
  }
  if (required.auth && !route.auth) {
    fail(`route "${key}" must attach the auth-jwt authorizer`);
  }
  if (!required.auth && route.auth) {
    fail(`route "${key}" is public (challenge/cookie auth) but declares an authorizer`);
  }
}

// ---------------------------------------------------------------------------
// 4b. WebSocket routes + endpoint must be declared
// ---------------------------------------------------------------------------
const declaredWs = new Map(wsRoutes.map((route) => [route.route, route]));

for (const required of REQUIRED_WEBSOCKET_ROUTES) {
  const route = declaredWs.get(required.route);
  if (!route) {
    fail(
      `MISSING WEBSOCKET ROUTE: ${required.route}  (${required.why})\n` +
        '      serverless-offline starts NO websocket server unless at least one `websocket` event exists,\n' +
        '      and no deployed WebSocket API is created either.',
    );
    continue;
  }
  if (route.fn !== required.fn) {
    fail(
      `websocket route "${required.route}" is handled by "${route.fn}" but REQUIRED_WEBSOCKET_ROUTES expects "${required.fn}"`,
    );
  }
}

const providerEnvironment = service?.provider?.environment ?? {};
if (!Object.hasOwn(providerEnvironment, 'WEBSOCKET_ENDPOINT')) {
  fail(
    'provider.environment is missing WEBSOCKET_ENDPOINT — src/shared/ws.ts reads it, and without the\n' +
      '      declaration an `environment`-scoped value can never reach the Lambdas (broadcastToAdmin no-ops).',
  );
}

// A loopback endpoint is correct for `serverless offline` but a deploy footgun:
// a local `npm run deploy` loads backend/.env and bakes the value into the
// stage. src/shared/ws.ts refuses loopback inside Lambda, so this is a warning.
const backendEnvPath = path.join(backendRoot, '.env');
if (existsSync(backendEnvPath)) {
  const envFile = readFileSync(backendEnvPath, 'utf8');
  const envFileValue = (key) => envFile.match(new RegExp(`^\\s*${key}\\s*=\\s*(\\S*)\\s*$`, 'm'))?.[1] ?? '';
  const isLoopback = (value) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value);

  const endpoint = envFileValue('WEBSOCKET_ENDPOINT');
  if (isLoopback(endpoint)) {
    warn(
      `backend/.env sets WEBSOCKET_ENDPOINT=${endpoint} (loopback). Correct for \`npm run offline\`,\n` +
        '      but unset it before deploying: src/shared/ws.ts refuses loopback endpoints inside Lambda,\n' +
        '      so the deployed stage would silently fall back to polling.',
    );
  }

  // The rest of these are the same trap in a nastier form: a local deploy
  // overrides the values the CI workflow sets, and nothing about the deploy
  // itself looks wrong. These ARE live in the deployed stage after such a run.
  if (['true', '1'].includes(envFileValue('COGNITO_OFFLINE').toLowerCase())) {
    warn(
      'backend/.env sets COGNITO_OFFLINE=true. Correct for `npm run offline`, but a local `npm run deploy`\n' +
        '      would ship the in-process Cognito stub: admin passwords verified against Mongo and the dev TOTP\n' +
        '      code 123456 accepted by a deployed Lambda. The CI workflow forces it to false; prefer the pipeline.',
    );
  }

  for (const [key, consequence] of [
    ['APP_BASE_URL', 'password-reset links in outbound email would point at localhost'],
    ['GOOGLE_REDIRECT_URI', 'resident Google SSO would redirect to localhost (and the Google console must allow it)'],
  ]) {
    const value = envFileValue(key);
    if (isLoopback(value)) {
      warn(
        `backend/.env sets ${key}=${value} (loopback). A local \`npm run deploy\` would ship it and\n` +
          `      ${consequence}. The CI workflow sets the deployed value.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4c. Local WS port must match the frontend's configured URL
// ---------------------------------------------------------------------------
const offlineOptions = service?.custom?.['serverless-offline'] ?? {};
const websocketPort = offlineOptions.websocketPort;
const httpPort = offlineOptions.port ?? 3000;
const lambdaPort = offlineOptions.lambdaPort ?? 3002;

if (websocketPort) {
  for (const [name, value] of [
    ['port (HTTP)', httpPort],
    ['lambdaPort (HTTP Lambda invoke)', lambdaPort],
  ]) {
    if (String(websocketPort) === String(value)) {
      fail(
        `custom.serverless-offline.websocketPort (${websocketPort}) collides with ${name} (${value}); a WS handshake there returns HTTP 404`,
      );
    }
  }
}

// `frontend/.env` is gitignored, so skip the comparison in CI rather than guess.
const frontendEnvPath = path.join(repoRoot, 'frontend', '.env');
if (existsSync(frontendEnvPath)) {
  const match = readFileSync(frontendEnvPath, 'utf8').match(
    /^\s*NEXT_PUBLIC_WEBSOCKET_URL\s*=\s*(\S+)\s*$/m,
  );
  const frontendWsUrl = match?.[1];
  if (!frontendWsUrl) {
    fail('frontend/.env does not set NEXT_PUBLIC_WEBSOCKET_URL (the browser has no WS target).');
  } else if (websocketPort) {
    let frontendPort = null;
    try {
      frontendPort = new URL(frontendWsUrl).port;
    } catch {
      fail(`frontend/.env NEXT_PUBLIC_WEBSOCKET_URL is not a valid URL: ${frontendWsUrl}`);
    }
    if (frontendPort && frontendPort !== String(websocketPort)) {
      fail(
        `frontend/.env NEXT_PUBLIC_WEBSOCKET_URL=${frontendWsUrl} targets port ${frontendPort} but\n` +
          `      custom.serverless-offline.websocketPort is ${websocketPort} — the handshake would 404.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4d. Cognito IAM + environment parity (Lambda execution role)
// ---------------------------------------------------------------------------
// `src/shared/cognito.ts` calls the Cognito IDP admin API. A missing
// `cognito-idp:*` grant is not a compile error and does not fail `sls deploy`:
// the deployed Lambda simply gets AccessDeniedException, which the gateway's
// `mapAuthError` fallback reports as 500 "Authentication service error." with no
// hint that IAM was the cause. The same is true of an undeclared
// COGNITO_CLIENT_SECRET — `${env:X}` only resolves for keys listed in
// provider.environment, so the Lambda sends no SECRET_HASH.
const cognitoSourcePath = path.join(backendRoot, 'src', 'shared', 'cognito.ts');
if (existsSync(cognitoSourcePath)) {
  const cognitoSource = readFileSync(cognitoSourcePath, 'utf8');
  const sdkImport = cognitoSource.match(
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]@aws-sdk\/client-cognito-identity-provider['"]/,
  );
  const cognitoCommands = sdkImport
    ? sdkImport[1]
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.endsWith('Command'))
        // `AdminInitiateAuthCommand` -> the IAM action `cognito-idp:AdminInitiateAuth`.
        .map((entry) => entry.slice(0, -'Command'.length))
    : [];

  const iamStatements = service?.provider?.iam?.role?.statements ?? [];
  const grantedCognitoActions = new Set();
  for (const statement of iamStatements) {
    const actions = Array.isArray(statement?.Action) ? statement.Action : [statement?.Action];
    const resources = Array.isArray(statement?.Resource) ? statement.Resource : [statement?.Resource];
    // Only count grants scoped to a user pool: the admin API authorizes against
    // `...:userpool/<pool-id>` (app clients are
    // `...:userpool/<pool-id>/client/<client-id>`).
    if (!resources.some((resource) => typeof resource === 'string' && resource.includes(':userpool/'))) {
      continue;
    }
    for (const action of actions) {
      if (typeof action !== 'string' || !action.startsWith('cognito-idp:')) continue;
      grantedCognitoActions.add(
        action === 'cognito-idp:*' ? '*' : action.slice('cognito-idp:'.length),
      );
    }
  }

  if (cognitoCommands.length === 0) {
    warn('no Cognito IDP commands found in src/shared/cognito.ts — the IAM parity check had nothing to verify');
  }
  for (const command of cognitoCommands) {
    if (grantedCognitoActions.has('*') || grantedCognitoActions.has(command)) continue;
    fail(
      `provider.iam.role.statements does not grant "cognito-idp:${command}" (used by src/shared/cognito.ts).\n` +
        '      Deployed admin login then fails with AccessDeniedException -> 500 "Authentication service error.".',
    );
  }

  if (!Object.hasOwn(providerEnvironment, 'COGNITO_CLIENT_SECRET')) {
    fail(
      'provider.environment is missing COGNITO_CLIENT_SECRET — src/shared/cognito.ts reads it to build SECRET_HASH.\n' +
        '      `${env:...}` only resolves for keys declared in the provider environment block.',
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Frontend contract parity (`/api/auth/...` literals)
// ---------------------------------------------------------------------------
function walkSourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || !statSync(full).isFile()) return [];
    return [full];
  });
}

const requiredPaths = new Set(REQUIRED_ROUTES.map((route) => route.path));
const referencedByFrontend = new Set();

for (const file of walkSourceFiles(frontendSrc)) {
  const source = readFileSync(file, 'utf8');
  const relative = path.relative(repoRoot, file);
  for (const match of source.matchAll(/["'`](\/api\/auth\/[A-Za-z0-9\-/]*)["'`]/g)) {
    const literal = match[1];
    const routePath = literal.replace(/^\/api\//, '').replace(/\/+$/, '');
    // Skip partial/template paths (e.g. `/api/auth/admin/${id}`) and Next.js
    // route handlers that are not part of the serverless API.
    if (!routePath || FRONTEND_LOCAL_ROUTES.has(routePath)) continue;

    referencedByFrontend.add(routePath);

    if (!declared.has(`post ${routePath}`) && !declared.has(`get ${routePath}`)) {
      fail(`frontend calls ${literal} (${relative}) but no route is declared for "${routePath}"`);
    }
    if (!requiredPaths.has(routePath)) {
      fail(`frontend calls ${literal} (${relative}) but "${routePath}" is not in REQUIRED_ROUTES`);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const authRoutes = httpRoutes
  .filter((route) => route.path.startsWith('auth/'))
  .sort((a, b) => a.path.localeCompare(b.path));

if (errors.length > 0) {
  console.error('\n\u2716 Route parity check FAILED\n');
  for (const error of errors) console.error(`  - ${error}`);
  for (const warning of warnings) console.error(`  \u26a0 ${warning}`);
  console.error(
    '\nFix `backend/serverless.yml` (or the frontend caller) and re-run `npm run verify:routes`.\n' +
      'Reminder: route-table changes need a FULL restart of `npm run offline`\n' +
      '(handler-code changes do too, unless you start it with `npm run offline:reload`).\n',
  );
  process.exit(1);
}

console.log('\u2714 Route parity check passed');
for (const warning of warnings) console.log(`  \u26a0 ${warning}`);
console.log(`  functions: ${Object.keys(functions).length}  |  http routes: ${httpRoutes.length}  |  auth routes: ${authRoutes.length}`);
console.log(`  required routes verified: ${REQUIRED_ROUTES.length}`);
console.log(
  `  websocket routes: ${wsRoutes.length} (required: ${REQUIRED_WEBSOCKET_ROUTES.length})` +
    (websocketPort ? `  |  offline websocketPort: ${websocketPort}` : ''),
);
console.log(`  frontend /api/auth callers verified: ${referencedByFrontend.size}`);
for (const route of authRoutes) {
  const flag = route.auth ? 'auth' : 'public';
  console.log(`    ${route.method.toUpperCase().padEnd(5)} ${route.path} (${flag})`);
}
