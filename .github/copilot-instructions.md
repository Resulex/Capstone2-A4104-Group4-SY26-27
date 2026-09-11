# KaBarangayConnect

Monorepo: `backend/` (serverless API — Node/TypeScript, Lambda + API Gateway, Mongoose) and
`frontend/` (Next.js 15 App Router, React 19, MUI). Overview: `README.md`; architecture:
`backend/docs/ARCHITECTURE.md`.

## Verify before reporting done

- Backend: `npm --prefix backend run typecheck` — there is exactly ONE known pre-existing error,
  `src/features/residents/get/handler.ts:34`; treat any other error as new. Run
  `npm --prefix backend run verify:routes` whenever `serverless.yml` changes.
- Frontend: `npx tsc --noEmit` (there is no `typecheck` script) and `npm run lint` in `frontend/`.
  Five pre-existing unused-import warnings are expected; don't "fix" them unless asked.
- Local E2E: backend `npm --prefix <abs>/backend run offline` (port 3000), frontend `npm run dev`
  (port 8000). Always start the backend with `--prefix` from outside the folder — a bare
  `cd backend && npm run offline` loses its cwd.

## Request path (frontend → backend)

`frontend/src/lib/api.ts` helpers (`getApi`/`postApi`/`patchApi`/`deleteApi`) call
`/api/backend/<path>`, which proxies to `http://localhost:3000/dev/<path>`. `next.config.ts` only
rewrites `/api/auth/{admin,resident}/*`; every other path goes through the `[...path]` route. Add new
backend calls as helpers here, not as raw `fetch`.

## Backend: function-per-use-case

- One handler per action: `src/features/<resource>/<action>/handler.ts`, exporting
  `handler = withErrorHandling(...)`.
- `serverless.yml` is the ONLY route registry. A handler file with no route block is not a compile
  error — it is a silent runtime 404. This has happened repeatedly (auth MFA routes, then
  `notifications/mine` + `notifications/read-all`), which is why `verify:routes` runs on
  `prebuild`/`predeploy`. When adding a frontend call, confirm its route is declared.
- Route-table changes need a FULL `npm run offline` restart; `reloadHandler` reloads handler code
  only, not routes.
- Reuse the shared layer rather than re-implementing: `shared/handler.ts` (`parseBody`,
  `parsePathParam`, `buildIdOrCustomIdQuery`), `shared/authorization.ts` (`resolveAuthContext`,
  `requireStaffOrAdmin`, `requireAdmin`, `requireAssignedRole`, `actorIdentity`),
  `shared/responses.ts`, `shared/errors.ts`, `shared/notifications.ts`.
- Models: `src/models/*.model.ts` with the barrel `src/models/index.ts`. Records carry a human id
  (`INC-…`, `REQ-…`, `NOT-…`) alongside the Mongo `_id`; accept either on lookup via
  `buildIdOrCustomIdQuery`. List/get handlers return the whole document, so a new schema field needs
  no handler change to serialize.
- Status changes append to the record's `timeline` (append-only — never rewrite an existing entry),
  keep the scalar `remarks` mirroring the latest entry, and notify all admins plus the affected
  resident.

## Auth model

Deliberately hybrid: AWS Cognito owns the admin password and software-token TOTP, Mongo `Admin`
stores profile/RBAC, and the backend issues its own HS256 session JWT in the httpOnly `kbc_token`
cookie. The JWT `sub` is the Mongo `_id` for both admins and residents. Admin `assignedRole` is one of
`SUPER_ADMIN | OPERATIONS_CLERK | INFO_OFFICER`. Setup notes: `backend/docs/COGNITO_AWS_CONSOLE.md`.

## Frontend conventions

- MUI with one import per module (`@mui/material/X`, `@mui/icons-material/X`).
- Admin pages guard with `useAuth()` plus `user?.role === "admin"`, and gate routes through
  `lib/rbac.ts` (`canAccessAdminRoute`).
- Backend record types live in `lib/admin.ts` and are reused by resident pages — extend them there
  instead of redeclaring shapes per page.
- Reuse `components/shared/TimelineSteps.tsx` for history views (pass `currentStatus`; `showActor`
  only for admin-facing views) and `StatusChip` for status colours.

## Local-stack gotchas

- No WebSocket endpoint is deployed (no `websocket` events in `serverless.yml`), so real-time
  delivery falls back to polling. `useOnlineStatus()` tracks browser connectivity only, so submit
  buttons stay enabled under `serverless-offline` even while the header chip reads "Offline".
- Dev data predates newer fields (e.g. incident/document `timeline`). UI must degrade gracefully for
  records without history rather than requiring a migration.
