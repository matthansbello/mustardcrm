# Mustard

CRM + cold email platform for sales teams on Google Workspace.

Mustard combines contact/pipeline CRM with multi-step cold email sequences sent **natively from connected Gmail or Zoho Mail inboxes** — with open/click/reply tracking, deliverability-safe sending caps, and a motion-rich dark UI.

## Stack

| Layer | Tech |
|-------|------|
| App | Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS 4 |
| Runtime | Node.js 24 (Netlify and Cloud Functions) |
| State | Zustand, TanStack Query / Table |
| Motion | GSAP (ScrollTrigger, Flip, custom hooks) |
| Backend | Firebase Auth, Firestore, Cloud Storage, Cloud Functions (2nd gen) |
| Email | Gmail API (`googleapis`) and Zoho Mail REST API, both via OAuth 2.0 |
| Import | PapaParse + SheetJS (CSV/XLSX) |

## Features

- Sign in with Google, Microsoft, Apple, GitHub, email + password, or a passwordless email link
- One shared workspace: every user sees every contact, company, deal, and sequence
- Send from Gmail / Google Workspace **or Zoho Mail** (any user can connect either, whatever they signed in with)
- Contacts, companies, deals (Kanban with GSAP Flip drag)
- CSV/XLSX bulk import with mapping, validation, and live progress
- Sequence builder with personalization tokens and launch guards
- Scheduled send engine (`onSequenceTick`) with idempotent sends
- Open/click tracking pixels + reply detection (Gmail Pub/Sub push; Zoho Mail mailbox search every 30 min and before each follow-up)
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
| `TOKEN_ENCRYPTION_KEY` | ≥32 chars — encrypts Gmail / Zoho refresh tokens |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` | Optional — enables “Connect Zoho Mail” (see below) |
| `CRON_SECRET` | Protects `/api/cron/sequence-tick` |
| `GOOGLE_REDIRECT_URI` | Default: `http://localhost:3000/api/auth/google/callback` |
| `FIREBASE_SERVICE_ACCOUNT` | Optional: whole service-account JSON in one value (instead of `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`). Verify with `npm run check:firebase` |
| `MUSTARD_ADMIN_EMAILS` | Comma-separated emails that are always admins; everyone else joins as a rep |
| `NEXT_PUBLIC_AUTH_METHODS` | Which sign-in buttons to show (`google,microsoft,apple,github,password,emaillink`) |

Generate secrets:

```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(32).toString('base64url')); console.log(c.randomBytes(32).toString('hex'));"
```

### 3. Google Cloud / Firebase

1. Create a Firebase project (Auth, Firestore, Storage, Functions on Blaze). Under **Authentication → Sign-in method**, enable each provider listed in `NEXT_PUBLIC_AUTH_METHODS` (Google, Microsoft, Apple, GitHub, Email/Password with **Email link** turned on). Add your deployed domain under **Authentication → Settings → Authorized domains**.
2. Enable **Gmail API** and **People API**.
3. Configure OAuth consent screen + Web client; add the redirect URI above.
4. Create Pub/Sub topic `gmail-push` for Gmail `users.watch` (reply detection).
5. Set `.firebaserc` project id and deploy rules/functions when ready.

### Zoho Mail (optional)

1. Go to the [Zoho API Console](https://api-console.zoho.com) → **Add Client** → **Server-based Applications**.
2. Homepage URL: your app URL. Authorized Redirect URI: `https://<your-domain>/api/auth/zoho/callback`
   (add `http://localhost:3000/api/auth/zoho/callback` for local testing).
3. Open the client's **Settings** tab and enable **Multi-DC** so mailboxes in the EU, India, Australia, etc. can connect.
4. Copy the Client ID / Secret into `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` (Netlify **and** Cloud Functions env).

Scopes requested: `ZohoMail.messages.CREATE`, `ZohoMail.messages.READ`, `ZohoMail.accounts.READ`.

### 4. Run locally

```bash
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

Optional emulators:

```bash
npm run emulators
```

## Migrating existing data to the shared workspace

Older versions gave each Gmail user / email domain its own organization. To merge them:

```bash
node scripts/migrate-to-shared-workspace.mjs          # dry run
node scripts/migrate-to-shared-workspace.mjs --apply  # copy everything into MUSTARD_WORKSPACE_ID
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run typecheck` | Type-check the app (`tsc --noEmit`) |
| `npm run functions:build` | Compile Cloud Functions |
| `npm run functions:deploy` | Deploy Functions only |
| `npm run firebase:deploy` | Deploy Firestore, Storage, Functions |
| `npm run emulators` | Start Firebase emulators |

## Project structure

```
app/                 # Next.js App Router (auth, dashboard, API) — `/` redirects to /dashboard
scripts/             # One-off maintenance scripts (shared-workspace migration)
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
| `GET /api/auth/zoho` | Start Zoho Mail OAuth |
| `GET /api/auth/zoho/callback` | Zoho OAuth code exchange |
| `POST /api/mailbox/disconnect` | Disconnect (and revoke) the caller's sending inbox |
| `GET /api/auth/google/callback` | OAuth code exchange |
| `POST /api/auth/session` | Firebase session cookie |
| `POST /api/auth/sync` | Create/refresh the user's profile in the shared workspace (sets role + claims server-side) |
| `GET /api/track/open` | Open tracking pixel |
| `GET /api/track/click` | Click redirect tracker |
| `POST /api/cron/sequence-tick` | Dev/prod send cron (`x-cron-secret`) |
| `POST /api/webhooks/gmail` | Reply webhook / Pub/Sub |

## Security notes

- Never commit `.env.local` or service account keys.
- Mailbox tokens (Gmail or Zoho) live encrypted in `tokens/{uid}` — Admin SDK only (Firestore rules deny client access).
- Prefer storing `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET` as Firebase Functions secrets in production.

## License

Private — all rights reserved.
