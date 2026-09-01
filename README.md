# KaBarangayConnect

**An Integrated Web-Based Management and Real-Time Incident Reporting System**

A platform connecting barangay residents, local officials, and services —
from announcements and incident reports to document requests and chat —
enabling streamlined administrative management and real-time incident reporting.

This repository is a monorepo containing two independent applications:

| Directory     | Description                                                               |
| ------------- | ------------------------------------------------------------------------- |
| [`backend/`](./backend/)   | Serverless API (Node.js + TypeScript, AWS Lambda + API Gateway, MongoDB) |
| [`frontend/`](./frontend/) | Next.js 15 client (React + MUI)                                           |

## Tech Stack

| Layer    | Technology                                                                    |
| -------- | ----------------------------------------------------------------------------- |
| Frontend | Next.js 15 (App Router), React 19, Material UI                                |
| Backend  | Node.js 20, TypeScript, Serverless Framework, AWS Lambda, Amazon API Gateway |
| Database | MongoDB Atlas (via Mongoose)                                                  |

## Repository Layout

```
.
├── backend/      # Serverless API — Function-per-Use-Case architecture
├── frontend/     # Next.js client
└── README.md     # This file
```

## Getting Started

Each application is set up independently. See the dedicated READMEs for
full instructions:

- **Backend** → [`backend/README.md`](./backend/README.md)
- **Frontend** → [`frontend/README.md`](./frontend/README.md)

### Prerequisites

- Node.js **>= 20** and npm
- For the backend: an [AWS account](https://aws.amazon.com) with configured
  credentials, a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, and
  the [Serverless Framework](https://www.serverless.com) (installed locally
  via npm).

### Quick start

```bash
# Backend (serverless offline, http://localhost:3000)
cd backend
npm install
cp .env.example .env   # then fill in MONGODB_URI, JWT_SECRET, etc.
npm run offline

# Frontend (Next.js dev server, http://localhost:8000)
cd frontend
npm install
cp .env.example .env   # then fill in API_BACKEND_URL, etc.
npm run dev
```

### Accessing the application

Once both servers are running, open the frontend in your browser:

| User   | URL                                    |
| ------ | -------------------------------------- |
| Resident | http://localhost:8000/login          |
| Admin  | http://localhost:8000/admin/login      |

### Sample credentials (for testing)

Seeded test accounts (see `backend/src/scripts/seed-data.ts`):

| Role          | Username   | Password       | Notes                                      |
| ------------- | ---------- | -------------- | ------------------------------------------ |
| Admin         | `r.cruz`   | `admin1`    | Full admin access                          |
| Moderator     | `m.reyes`  | `admin1 | Full admin access       |
| Content Admin | `j.bautista` | `admin1` | Full admin access          |

> **Note:** MFA is not pre-enrolled for seeded accounts. On first admin login
> you'll be prompted to enroll a TOTP authenticator (e.g. Google Authenticator)
> before you can complete the sign-in.

## Environment Variables

Both applications read configuration from a `.env` file (not committed to
source control). Copy the provided `.env.example` in each folder and adjust
as needed. See the individual READMEs for the full variable reference.
