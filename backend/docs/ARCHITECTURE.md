# Architecture Reference — KaBarangayConnect Backend

This document is the **canonical reference** for the KaBarangayConnect backend.
Future prompts and contributors should treat it as the basis for building and
extending the system.

---

## 1. Overview

KaBarangayConnect is a serverless backend that connects barangay residents,
local officials, and services. It is built as a **Function-per-Use-Case
serverless architecture**: every business use-case maps to exactly one AWS
Lambda function and one handler module.

| Layer                | Technology                              |
| -------------------- | --------------------------------------- |
| Language             | Node.js + TypeScript                    |
| Compute              | AWS Lambda                              |
| API Router           | Amazon API Gateway (REST API)           |
| Database ODM         | Mongoose                                |
| Database             | MongoDB Atlas                           |
| Architecture pattern | Function-per-Use-Case Serverless        |
| Deployment framework | Serverless Framework (`serverless.yml`) |

### Why Function-per-Use-Case?

- **Independent scaling & isolation** — each use-case scales and fails
  independently; a cold start in one feature does not affect others.
- **Minimal cold-start footprint** — each function bundles only the code it
  needs, keeping package size small.
- **Explicit IAM and permissions** — each function can be granted only the
  privileges it needs.
- **Clear ownership** — a new feature is a self-contained folder, easy to
  review, test, and deploy.

---

## 2. Folder Structure

```
src/
├── config/
│   └── db.ts                    # Cached Mongoose connection singleton
├── models/                      # Mongoose models (one file per domain entity)
│   ├── user.model.ts
│   ├── barangay.model.ts
│   ├── announcement.model.ts
│   └── index.ts                 # Re-exports all models
├── shared/                      # Reusable cross-cutting utilities
│   ├── auth.ts                  # JWT sign/verify + bearer extraction
│   ├── errors.ts                # AppError + typed error helpers
│   ├── handler.ts               # withErrorHandling wrapper + parseBody
│   ├── password.ts              # bcrypt hash/compare
│   └── responses.ts             # HTTP response builders
└── features/                    # ONE feature per folder
    ├── auth/
    │   ├── register/
    │   │   └── handler.ts       # POST /auth/register
    │   ├── login/
    │   │   └── handler.ts       # POST /auth/login
    │   └── authorizer/
    │       └── handler.ts       # Custom JWT authorizer
    └── users/
        └── get-profile/
            └── handler.ts       # GET /users/me (protected)
```

### Conventions

- **Feature folder** names are lowercase plural nouns (`auth`, `users`,
  `announcements`).
- **Use-case folder** names are kebab-case verbs describing the action
  (`get-profile`, `create-announcement`, `update-status`).
- **Each use-case exposes a `handler.ts`** that exports a named `handler`
  function consumed by `serverless.yml` (e.g.
  `src/features/users/get-profile/handler.handler`).
- **Models live centrally** in `src/models/` and are imported by any feature
  that needs them. Model concerns are never duplicated inside a feature.

---

## 3. Handler Lifecycle

Every use-case handler follows the same shape:

```ts
export async function getProfile(event, context) {
  // 1. Parse & validate the request (parseBody / manual checks)
  // 2. Connect to the database (connectToDatabase)
  // 3. Run the use-case logic against models
  // 4. Return a structured APIGatewayProxyResult
}

export const handler = withErrorHandling(getProfile);
```

`withErrorHandling` (in `src/shared/handler.ts`) wraps the logic so that:

- Thrown `AppError` instances are mapped to their status code + JSON body.
- Unknown exceptions are logged with `console.error` and returned as a
  **500** without leaking internal details.
- CORS headers are attached to every response.

### Response contract

Every response is JSON with a uniform envelope and CORS headers:

```json
{ "success": true,  "data": { }, "message": "..." }   // 2xx
{ "success": false, "message": "...", "details": {} }  // 4xx/5xx
```

Response builders live in `src/shared/responses.ts`
(`ok`, `created`, `badRequest`, `unauthorized`, `forbidden`, `notFound`,
`conflict`, `unprocessable`, `serverError`).

---

## 4. Database Connectivity

Mongoose + MongoDB Atlas. **One shared cached connection**, defined in
`src/config/db.ts`.

Why it matters in serverless: AWS may reuse the same Lambda execution
environment across warm invocations. Opening a TCP connection (plus the TLS
handshake to MongoDB Atlas) on every warm call is slow and wasteful. The module
caches the connection at module scope so it survives across invocations.

Key points:

- Call `await connectToDatabase()` at the top of any handler that touches Mongo.
- The connection is a module-level singleton with `maxPoolSize: 1` (a Lambda
  container processes one request at a time).
- Concurrent warm invocations share a single in-flight connection promise,
  preventing duplicate connections.
- Never store connection state inside a handler.

---

## 5. Authentication & Authorization

- **Hashing:** `bcryptjs` via `src/shared/password.ts` (`hashPassword`,
  `comparePassword`).
- **Tokens:** `jsonwebtoken` via `src/shared/auth.ts`.
  - `signToken(userId, role)` issues a JWT with claims `{ sub, role }`.
  - `verifyToken(token)` verifies and returns the payload or throws a 401
    `AppError`.
  - `extractBearerToken(header)` parses `Authorization: Bearer <token>`.
- **Authorizer:** `src/features/auth/authorizer/handler.ts` is a custom API
  Gateway **REQUEST authorizer**. Protected endpoints declare it in
  `serverless.yml`:

```yaml
authorizer:
  name: auth-jwt
  type: REQUEST
  resultTtlInSeconds: 0
  identitySource: method.request.header.Authorization
```

On success the authorizer emits an allow policy and injects `userId` and `role`
into `event.requestContext.authorizer`, where protected handlers read them.

---

## 6. API Gateway Mapping

`serverless.yml` maps each function to one HTTP event. The convention:

```yaml
features-auth-register:            # <feature>-<use-case>
  handler: src/features/auth/register/handler.handler
  events:
    - http:
        path: auth/register
        method: post
        cors: true
```

- Function names follow `<feature>-<use-case>`.
- `handler` path is relative to the project root, ending at the exported
  `handler` name.
- Public endpoints have no `authorizer`; protected endpoints reference the
  `auth-jwt` authorizer (see §5).

---

## 7. Deployment & Bundling

Dependencies

- `serverless-esbuild` bundles each handler independently, tree-shaking so each
  Lambda ships only what it needs.
- `serverless-offline` runs the API locally for development.

Lifecycle

```bash
npm run typecheck   # tsc --noEmit
npm run build       # serverless package (bundle + validate config)
npm run deploy      # deploy to AWS
npm run offline     # local server on :3000
npm install         # first-time setup
```

On deploy, Serverless provisions: the Lambda functions, an API Gateway REST
API with the events above, environment variables from `.env`, and the IAM role.

> Deploy requires an AWS account with credentials configured and a reachable
> MongoDB Atlas cluster. Without `serverless-offline`, local runs also need
> `.env` set.

---

## 7b. Migrations & Seeding

Migrations and seeding run **locally** via `ts-node` (not as Lambda functions).
They require `MONGODB_URI` in `.env`.

### Migrations

Migrations are versioned TypeScript files in `src/migrations/` that export
`up(db)` and `down(db)`. They are executed in lexicographic (timestamp) order
and tracked in the `schema_migrations` changelog collection so each runs exactly
once.

```bash
npm run migrate            # apply all pending migrations (up)
npm run migrate:down       # revert the most recent applied migration
npm run migrate:status     # list migrations + applied state
npm run migrate:create <name>  # scaffold a new timestamped migration file
```

Shared, reusable index definitions live in `src/migrations/indexes.ts`
(`createSeededIndexes` / `dropSeededIndexes`) so `up`/`down` stay symmetric.

### Seeding

The seeder (`src/scripts/seed.ts`) populates a fresh database with realistic,
deterministic data from `src/scripts/seed-data.ts`. It is **insert-only** —
collections that already contain documents are skipped, so re-running is safe.

```bash
npm run seed   # ts-node src/scripts/seed.ts
```

Seed order respects foreign keys: Barangay → Officials → Admins → Residents →
Announcements → Incidents → Document Requests → Chat Sessions → Messages →
Notifications. Resident/admit passwords are hashed via `src/shared/password.ts`
at runtime, and S3 placeholder URLs are derived from `S3_BUCKET_NAME` /
`S3_BUCKET_REGION` env vars (defaulting to the values in `.env.example`).

---

## 7c. Authorization & RBAC (CRUD)

Every CRUD endpoint created for the business models is **authenticated and
authorized**. Authentication is handled by the custom `auth-jwt` REQUEST
authorizer (§5), which verifies the JWT and injects `userId` + `role` into
`event.requestContext.authorizer`. Roles are authorized **inside each handler**
using the shared helpers in `src/shared/authorization.ts`.

### Roles

- **JWT `role`** comes from `User.role`: `'resident' | 'official' | 'admin'`.
- The `Admin` collection's `assignedRole` (`'Admin' | 'Moderator' |
  'Content Admin'`) is a **secondary tier** used for admin-management
  operations (creating/deleting admins, changing roles). Admins authenticate as
  `User.role === 'admin'`; the `Admin` record is resolved via
  `resolveAuthContext`.

### Shared helpers (`src/shared/authorization.ts`)

- `getAuthContext(event)` — reads caller identity/role from the authorizer.
- `resolveAuthContext(event)` — same, plus loads the `Admin` record for
  `role === 'admin'` (exposes `assignedRole`).
- Guards: `requireAdmin`, `requireStaffOrAdmin`, `requireAssignedRole(...)`,
  `assertResidentOwnership`, `assertOwnResidentRecord`, `assertOwnResidentRef`.
- Scoping: `residentScopeFilter`, `notificationScopeFilter` build query filters
  for data isolation.
- `parsePathParam` (in `src/shared/handler.ts`) reads `/{id}` path params.

### Data isolation matrix

| Role     | Residents list | Resident-owned records (doc requests, incidents, chat, notifications) | Admin collection |
| -------- | -------------- | ---------------------------------------------------------------------- | ---------------- |
| resident | own record only | own records only | denied |
| official | own barangay   | barangay scope   | denied |
| admin    | all            | all               | full (+ assignedRole tier for admin mgmt) |

### Route conventions

Each model is a feature folder under `src/features/<model>/` with five use-case
handlers: `create`, `list`, `get`, `update`, `delete`. All routes in
`serverless.yml` attach the `auth-jwt` authorizer block (copied from
`users-get-profile`). Function naming is `<model>-<action>` (e.g.
`residents-list`, `document-requests-create`). A few special cases:

- `messages/list` uses `POST /messages/search` (accepts a `{ sessionId }` body
  to scope by chat-session participation).
- `officials/delete` **soft-deletes** (`isDeleted = true`) for archiving.
- `users/get-profile` (`GET /users/me`) already existed and remains the
  authenticated self-profile endpoint.

---

## 8. How to Add a New Feature

Follow this exact sequence when extending the system.

1. **Model** (if a new entity): add `src/models/<entity>.model.ts` defining the
   schema + `Model<Interface>`, then re-export it from `src/models/index.ts`.
2. **Shared utilities** (if reuse is needed): extend `src/shared/` rather than
   duplicating logic inside the feature.
3. **Handler**: create
   `src/features/<feature>/<use-case>/handler.ts`:
   - export an inner async function that parses, connects, executes, returns;
   - export `export const handler = withErrorHandling(<fn>)`.
4. **Route**: declare the function in `serverless.yml` under `functions:`,
   following the `<feature>-<use-case>` naming and the event mapping in §6.
   Add an `authorizer` block if the endpoint must be authenticated.
5. **Environment**: add any new variables to `.env.example` and to
   `serverless.yml` → `provider.environment`.
6. **Verify**: `npm run typecheck`, then `npm run build`, then optionally
   `npm run offline` to smoke-test the new endpoint.

### Rules of thumb

- One use-case = one handler = one function.
- Keep handlers thin; push domain logic into models/shared helpers when it
  grows.
- Always connect via `connectToDatabase()` — never create a per-request
  connection.
- Always wrap with `withErrorHandling` and return builders from
  `responses.ts`.
- Do not put secrets in code — read them from env vars populated by
  `serverless.yml`.

---

## 9. Roadmap / Planned Features

Future use-cases can be added by following §8. Highly likely upcoming features:

- `announcements` — create / list / update announcements.
- `barangays` — CRUD for barangay records.
- `alerts` — advisory alerts for residents.
- `reports` — incident/service reports with status transitions.
- `notifications` — push/notification dispatch.
- `admin` — user management and role management.

Each of these should land as one feature folder under `src/features/` with one
handler per use-case, wired through `serverless.yml`, per the conventions in §8.