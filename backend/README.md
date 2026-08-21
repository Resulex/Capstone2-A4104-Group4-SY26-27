# KaBarangayConnect — Backend

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

## Local Development

Run the API locally with `serverless-offline` (requires `.env` with `MONGODB_URI`):

```bash
npm run offline
```

The API is then served at `http://localhost:3000`. Example warm-up:

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
| `npm run build`          | `serverless package` (bundle + validate) |
| `npm run deploy`         | Deploy to AWS                            |
| `npm run offline`        | Run API locally via serverless-offline   |
| `npm run lint`           | Run ESLint on `src`                      |

## Adding a New Feature

See the step-by-step guide and conventions in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#how-to-add-a-new-feature).