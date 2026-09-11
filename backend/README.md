# KaBarangayConnect — Backend

**An Integrated Web-Based Management and Real-Time Incident Reporting System**

Serverless backend for **KaBarangayConnect**, a platform connecting residents,
local officials, and services within a barangay.

## Tech Stack

| Layer                | Technology                         |
| -------------------- | ---------------------------------- |
| Language             | Node.js + TypeScript               |
| Compute              | AWS Lambda                         |
| API Router           | Amazon API Gateway                 |
| Database ODM         | Mongoose                           |
| Database             | MongoDB Atlas                      |
| Architecture pattern | Function-per-Feature / Use-Case    |
| Deployment framework | Serverless Framework (`serverless`) |

## Architecture

This repository follows a **Function-per-Use-Case serverless architecture**. Each
business use-case is a dedicated AWS Lambda function backed by its own handler
module under `src/features/<feature>/<use-case>/handler.ts`.

> Refer to [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full
> architectural reference, conventions, and the guide for adding new features.

## Repository Layout

```
.
├── serverless.yml                 # Infrastructure-as-code (functions, API Gateway events)
├── src/
│   ├── config/
│   │   └── db.ts                  # Cached Mongoose connection singleton
│   ├── models/                    # Mongoose models & schemas
│   │   ├── user.model.ts
│   │   ├── barangay.model.ts
│   │   ├── announcement.model.ts
│   │   └── index.ts
│   ├── shared/                    # Cross-cutting utilities shared by features
│   │   ├── auth.ts                # JWT sign/verify, bearer extraction
│   │   ├── errors.ts              # AppError + helpers
│   │   ├── handler.ts             # withErrorHandling wrapper, parseBody
│   │   ├── password.ts            # bcrypt hash/compare
│   │   └── responses.ts           # ok/created/badRequest/... responses
│   └── features/                  # ONE folder per feature
│       ├── auth/
│       │   ├── register/handler.ts        # POST /auth/register
│       │   ├── login/handler.ts           # POST /auth/login
│       │   └── authorizer/handler.ts      # Custom JWT authorizer
│       └── users/
│           └── get-profile/handler.ts     # GET /users/me (protected)
├── docs/
│   └── ARCHITECTURE.md            # Full architecture reference
├── tsconfig.json
├── .env.example                  # Environment variable template
└── package.json
```

## Prerequisites

- Node.js **>= 20**
- npm
- An [AWS account](https://aws.amazon.com) with configured credentials
  (`~/.aws/credentials` or the `AWS_PROFILE` env var)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster and connection string
- Serverless Framework CLI (installed locally via `npm` — no global install needed)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# ...then edit .env with your MONGODB_URI, JWT_SECRET, AWS_REGION
```

## Environment Variables

| Variable        | Description                            | Example |
| --------------- | -------------------------------------- | ------- |
| `MONGODB_URI`   | MongoDB Atlas connection string        | `mongodb+srv://...` |
| `AWS_REGION`    | AWS region for deployment              | `ap-southeast-1` |
| `JWT_SECRET`    | Secret used to sign/verify JWTs        | any long random string |
| `JWT_EXPIRES_IN`| JWT lifetime (jsonwebtoken format)     | `7d` |
| `STAGE`         | Deployment stage                       | `dev` |
| `COGNITO_USER_POOL_ID` | Admin Cognito User Pool id (create in the AWS console — see `docs/COGNITO_AWS_CONSOLE.md`) | `ap-southeast-1_AbCdEf` |
| `COGNITO_CLIENT_ID`    | Admin Cognito app client id           | `1abcdefg...` |
| `COGNITO_REGION`       | Region of the user pool               | `ap-southeast-1` |
| `COGNITO_OFFLINE`      | Use the in-process Cognito stub for local dev (no AWS) | `false` |
| `COGNITO_PROVISION_PASSWORD` | Initial password `provision:cognito` sets for seed admins | — |
| `WEBSOCKET_ENDPOINT` | management-API endpoint for real-time pushes (`src/shared/ws.ts`). Empty ⇒ `broadcastToAdmin` no-ops. Local `serverless offline` emulates the WS API on port **3001**; deployed value is `wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>` | `http://localhost:3001` |

> Admin login uses **AWS Cognito User Pools with software-token MFA (TOTP —
> Google Authenticator)** — see `docs/ARCHITECTURE.md` §5a and the console
> walkthrough `docs/COGNITO_AWS_CONSOLE.md`. The legacy custom otplib TOTP
> code (`shared/totp.ts`, `auth/admin/totp/*`) is deprecated and kept for
> rollback only.

## Local Development

Run the API locally with `serverless-offline` (requires `.env` with `MONGODB_URI`):

```bash
npm run offline
```

The API is then served at `http://localhost:3000`.

> **Admin login (Cognito):** admin login is backed by AWS Cognito
> (software-token TOTP = Google Authenticator). For local development without
> a live pool, set `COGNITO_OFFLINE=true` in `.env` — the backend then verifies
> admin passwords against Mongo and accepts the dev TOTP code `123456` (see
> `src/shared/cognito.ts`). Example warm-up:

> **Route-table changes need a FULL restart.** Adding or renaming a function or
> route in `serverless.yml` requires stopping `npm run offline` (and freeing
> port 3000) before starting it again, otherwise requests 404 with
> `Serverless-offline: route not found.`
>
> **Handler-code edits need a restart too.** `reloadHandler` is deliberately OFF:
> with it on, serverless-offline builds a fresh worker thread — and therefore a
> fresh MongoDB connection to Atlas — for *every* request (~1.5s added to each
> call). Use `npm run offline:reload` while you are actively editing a handler;
> it is slower per request but applies code changes immediately.

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Juan","lastName":"Dela Cruz","email":"juan@example.com","password":"secret123","barangayId":"<valid-barangay-id>"}'
```

## Deploying

```bash
# Type-check
npm run typecheck

# Package locally (validates serverless.yml + esbuild bundling)
npm run build

# Deploy to AWS (stage from STAGE env, or use --stage)
npm run deploy
```

After deployment, Serverless prints the API Gateway endpoint:
`https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/`.

## Common Commands

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `npm run typecheck`      | Run `tsc --noEmit`                       |
| `npm run verify:routes`  | Route parity guard (frontend contract ↔ `serverless.yml`) |
| `npm run build`          | `serverless package` (bundle + validate; runs `verify:routes` first) |
| `npm run deploy`         | Deploy to AWS (runs `verify:routes` first) |
| `npm run offline`        | Run API locally via serverless-offline   |
| `npm run lint`           | Run ESLint on `src`                      |

### Route parity guard

`serverless.yml` is the only place HTTP routes are registered, and a missing
route is not a compile error — the frontend simply receives a 404. This has
regressed twice (the admin MFA/Cognito and `ws-token` routes), so
`npm run verify:routes` (`scripts/verify-routes.mjs`) checks that:

- every `handler: <module>.<export>` points at a file that exports that symbol;
- no `METHOD path` is declared twice;
- every route in the script's `REQUIRED_ROUTES` (the auth surface contract) is
  declared, with the expected authorizer;
- every `/api/auth/...` literal the frontend calls maps to a declared route and
  is listed in `REQUIRED_ROUTES` (so the list cannot silently go stale).

It runs automatically before `npm run build` and `npm run deploy`, so removing a
route from `serverless.yml` fails the build instead of 404-ing at runtime. When
you add an auth route, add it to `REQUIRED_ROUTES` too.

## Adding a New Feature

See the step-by-step guide and conventions in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#how-to-add-a-new-feature).