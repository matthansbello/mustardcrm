# Mustard

CRM + cold email platform for sales teams on Google Workspace.

Mustard combines contact/pipeline CRM with multi-step cold email sequences sent **natively from connected Gmail accounts** — with open/click/reply tracking, deliverability-safe sending caps, and a motion-rich dark UI.

## Stack

| Layer | Tech |
|-------|------|
| App | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| State | Zustand, TanStack Query / Table |
| Motion | GSAP (ScrollTrigger, Flip, custom hooks) |
| Backend | Firebase Auth, Firestore, Cloud Storage, Cloud Functions (2nd gen) |
| Email | Gmail API via OAuth 2.0 (`googleapis`) |
| Import | PapaParse + SheetJS (CSV/XLSX) |

## Features

- Google Workspace sign-in + incremental Gmail OAuth
- Contacts, companies, deals (Kanban with GSAP Flip drag)
- CSV/XLSX bulk import with mapping, validation, and live progress
- Sequence builder with personalization tokens and launch guards
- Scheduled send engine (`onSequenceTick`) with idempotent sends
- Open/click tracking pixels + reply detection via Gmail Pub/Sub
- Team invites, roles, deactivate + reassignment
- Dashboard KPIs from aggregation stats

## Getting started

### 1. Install

```bash
npm install
npm --prefix functions install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in Firebase client/admin credentials, Google OAuth client, and:

| Variable | Notes |
|----------|--------|
| `TOKEN_ENCRYPTION_KEY` | ≥32 chars — encrypts Gmail refresh tokens |
| `CRON_SECRET` | Protects `/api/cron/sequence-tick` |
| `GOOGLE_REDIRECT_URI` | Default: `http://localhost:3000/api/auth/google/callback` |

Generate secrets:

```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(32).toString('base64url')); console.log(c.randomBytes(32).toString('hex'));"
```

### 3. Google Cloud / Firebase

1. Create a Firebase project (Auth with Google provider, Firestore, Storage, Functions on Blaze).
2. Enable **Gmail API** and **People API**.
3. Configure OAuth consent screen + Web client; add the redirect URI above.
4. Create Pub/Sub topic `gmail-push` for Gmail `users.watch` (reply detection).
5. Set `.firebaserc` project id and deploy rules/functions when ready.

### 4. Run locally

```bash
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

Optional emulators:

```bash
npm run emulators
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run functions:build` | Compile Cloud Functions |
| `npm run functions:deploy` | Deploy Functions only |
| `npm run firebase:deploy` | Deploy Firestore, Storage, Functions |
| `npm run emulators` | Start Firebase emulators |

## Project structure

```
app/                 # Next.js App Router (marketing, auth, dashboard, API)
components/          # UI (CRM, sequences, team, layout, analytics)
lib/                 # Firebase, services, email, GSAP hooks, crypto
functions/           # Cloud Functions (tick, import, track, Gmail push)
types/               # Shared Firestore domain types
firestore.rules      # Security rules
storage.rules        # Storage rules
```

## API surfaces

| Endpoint | Purpose |
|----------|---------|
| `GET /api/auth/google` | Start Gmail OAuth |
| `GET /api/auth/google/callback` | OAuth code exchange |
| `POST /api/auth/session` | Firebase session cookie |
| `POST /api/auth/claims` | Sync custom role claims |
| `GET /api/track/open` | Open tracking pixel |
| `GET /api/track/click` | Click redirect tracker |
| `POST /api/cron/sequence-tick` | Dev/prod send cron (`x-cron-secret`) |
| `POST /api/webhooks/gmail` | Reply webhook / Pub/Sub |

## Security notes

- Never commit `.env.local` or service account keys.
- Gmail tokens live in `tokens/{uid}` — Admin SDK only (Firestore rules deny client access).
- Prefer storing `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET` as Firebase Functions secrets in production.

## License

Private — all rights reserved.
