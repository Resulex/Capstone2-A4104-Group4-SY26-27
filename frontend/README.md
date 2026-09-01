# KaBarangayConnect — Frontend

**An Integrated Web-Based Management and Real-Time Incident Reporting System**

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Authentication

The frontend authenticates against the **KaBarangayConnect** serverless backend
(`serverless offline` → `http://localhost:3000`).

The backend routes are proxied behind relative `/api/...` paths via the
`rewrites()` in `next.config.ts` (no CORS configuration required):

- `/api/auth/admin/*` → backend `/auth/admin/*`
- `/api/auth/resident/*` → backend `/auth/resident/*`

### Environment variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
| --- | --- | --- |
| `API_BACKEND_URL` | `http://localhost:3000` | Base URL of the REST backend |
| `API_BACKEND_STAGE` | `dev` | Stage prefix used by `serverless offline` |
| `API_WEBSOCKET_URL` | `ws://localhost:3002` | Base URL of the WebSocket server |

### Admin login (`/admin/login`)

1. Admin enters username/password (and their assigned role).
2. Admin enters the 6-digit TOTP code from Google Authenticator.
3. The frontend sends **one** `POST /api/auth/admin/login` request containing
   `{ username, password, role, totp }`.
4. The returned JWT is stored in an **httpOnly cookie** via
   `POST /api/auth/callback`, then the admin is redirected to `/`.

### Resident login (`/login`)

1. Resident clicks **Continue with Google**.
2. The frontend calls `GET /api/auth/resident/google`, opens the returned OAuth
   URL in a popup.
3. Google redirects to the backend callback, which performs the OAuth handshake
   and `postMessage`s the JWT (`{ token, isNewUser }`) back to this page.
4. The frontend stores the JWT in an httpOnly cookie and redirects to `/`.
   First-time resident registration is handled server-side by the backend.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
