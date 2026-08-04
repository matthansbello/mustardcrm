# Execution Prompt — Build "Mustard" (CRM + Cold Email Platform)

> **How to use this file**: Paste the prompt below (everything inside the fenced block, or the whole document) into Claude Code, Cursor, or another coding agent as the kickoff instruction for building the project. It references the PRD and User Journey docs — keep those two files in the same repo/context so the agent can pull details from them as it works. Attach `prd.md` and `userjourney.md` alongside this prompt.

---

```
You are building "Mustard" — a CRM + Cold Email platform for teams on Google Workspace.

Full requirements are in 01-PRD-Mustard.md and 02-User-Journey-Mustard.md — read both fully before
writing any code. Follow them as the source of truth for features, data model, and UX flows.
This prompt tells you HOW to execute the build: stack setup, phasing, and quality bar.

============================================================
TECH STACK (non-negotiable)
============================================================
- Next.js 14+ (App Router), TypeScript, strict mode on.
- Tailwind CSS for styling.
- Firebase: Auth (Google provider), Firestore, Cloud Functions (2nd gen), Cloud Storage.
- GSAP (core + ScrollTrigger, Flip, Draggable plugins) for all animation — no other animation
  library (no Framer Motion) unless I explicitly ask for it.
- PapaParse for CSV parsing, SheetJS (xlsx) for Excel parsing.
- TanStack Table for data grids, TanStack Query or Firestore onSnapshot listeners for data sync.
- Zustand for lightweight global client state.
- Google APIs: Gmail API + People API via OAuth 2.0 (googleapis npm package on the server/Functions side).

============================================================
DESIGN LANGUAGE
============================================================
Dark-mode-first, aggressively futuristic. Think: deep charcoal/near-black backgrounds, glassmorphic
panels (backdrop-blur + subtle border glow), a saturated accent gradient (pick a confident
signature gradient — e.g. amber/mustard-yellow into deep violet or electric blue — and use it
consistently for primary actions, focus states, and data highlights), sharp modern sans-serif
typography (e.g. a geometric/grotesk-style font), fine grid or particle background textures on
empty/landing states, subtle glow/neon edge treatments on interactive elements.

Motion is a first-class requirement, not a polish pass at the end:
- Build a small internal `useGsapReveal` / `useStagger` hook pattern early so every new screen can
  opt into consistent entrance animation without re-writing GSAP timelines each time.
- Use GSAP Flip for any reordering UI (Kanban drag, table row insert/remove, import progress).
- Use GSAP ScrollTrigger on the landing/marketing page.
- Respect `prefers-reduced-motion`: build a `useReducedMotion` check into the animation hooks from
  day one, not bolted on later.
- Animations should feel expensive and intentional — eased, staggered, physical — but must NEVER
  block or delay the user's ability to act (e.g., don't gate a form's "Save" button behind an
  animation finishing).

============================================================
BUILD PHASES — execute in this order, and stop for my review at the end of each phase
============================================================

PHASE 0 — Project Scaffold
- Initialize Next.js (TypeScript, App Router, Tailwind) project named `mustard`.
- Set up Firebase project config (Auth, Firestore, Functions, Storage) with environment variables
  documented in a `.env.example` file — do not hardcode any keys.
- Set up the Firebase Admin SDK for server-side/Functions use, and the Firebase client SDK for the
  browser, clearly separated (`/lib/firebase/client.ts` and `/lib/firebase/admin.ts`).
- Establish the base folder structure:
  /app
    /(marketing)         -> landing page
    /(auth)              -> signup/login/onboarding
    /(dashboard)
      /contacts
      /companies
      /deals
      /sequences
      /team
      /settings
  /components
  /lib
  /functions             -> Cloud Functions source
  /types                 -> shared TypeScript types/interfaces matching Firestore schema in the PRD
- Define TypeScript interfaces for every Firestore collection listed in the PRD's "Technical
  Architecture" section before writing any UI that depends on them.
- Set up base Tailwind theme (colors, font, spacing) matching the design language above, and install
  GSAP with the plugins listed.
- Deliverable: app boots locally, shows a styled placeholder dashboard shell with nav, dark theme
  and one working GSAP entrance animation, Firebase Auth wired but not yet fully flowed.

PHASE 1 — Auth, Onboarding & Google Workspace Connection
- Implement Firebase Auth with Google provider (Journey 1 in the User Journey doc).
- Implement the 3-step onboarding flow (org name -> connect Gmail -> import contacts now/later).
- Implement the incremental OAuth flow requesting Gmail scopes (gmail.send, gmail.readonly or
  gmail.modify, offline access) — store refresh tokens server-side via a Cloud Function endpoint,
  encrypted, in a locked-down `tokens/{uid}` collection that only Admin SDK can touch (write the
  Firestore security rules for this now, not later).
- Build the "Connection status" UI component (Connected / Needs Reauth / Disconnected) reusable on
  both the onboarding flow and the Team settings page.
- Deliverable: a real user can sign up, connect their Gmail, and land on an empty dashboard.

    PHASE 2 — CRM Core (Contacts, Companies, Deals)
    - Build the Contacts list (TanStack Table, virtualized, real-time via Firestore listener).
- Build "Add Contact" manual flow exactly as described in Journey 2, including the debounced
  duplicate-email check.
- Build the CSV/XLSX bulk import flow exactly as described in Journey 3:
  upload -> column mapping -> validation preview -> confirm -> progress -> completion summary.
  Do the heavy parsing/writing in a Cloud Function triggered off a Cloud Storage upload + an
  `importJobs` Firestore doc that the client subscribes to for live progress.
  Batch Firestore writes in chunks of 400-500 to respect batch limits.
- Build Companies (linked to contacts) and Deals (Kanban board with GSAP Flip drag reflow).
- Build the per-contact Activity Timeline component (reusable — will also show email events later).
- Deliverable: contacts can be added one-by-one or via CSV/XLSX exactly per the PRD's dedup and
  validation rules, and show up correctly in a working pipeline Kanban.

PHASE 3 — Cold Email Sequence Engine
- Build the Sequence Builder UI per Journey 4 (visual timeline, steps with day-delays and
  reply-based branching, token-based personalization with live preview, sending window/cap
  settings, enrollment picker).
- Build the token validation guard that blocks "Launch" if any enrolled contact is missing a
  required personalization field.
- Build the `onSequenceTick` scheduled Cloud Function: finds due sends, respects per-mailbox daily
  caps and sending windows, sends via Gmail API using raw MIME so mail appears in the rep's own
  Sent folder and threads natively with the recipient.
- Implement idempotent send guarding (a `sendAttemptId` per enrollment step) so retries never
  double-send.
- Build open tracking (pixel endpoint) and click tracking (redirect endpoint) as HTTPS Cloud
  Functions, logging to `emailEvents`.
- Build the reply/bounce detection function using Gmail `watch` + Pub/Sub (not polling), which
  pauses the enrollment and updates the linked deal stage automatically.
- Deliverable: a sequence can be built, launched, and will actually send real emails on schedule
  from a connected Gmail account, with opens/clicks/replies reflected back into the CRM.

PHASE 4 — Team Management
- Build Team settings: single invite, bulk invite via CSV/XLSX (reuse the Phase 2 import engine with
  a name/email/role schema), per-teammate connection status, role-based access (Admin/Manager/Rep)
  via Firebase custom claims, deactivation + contact/deal reassignment flow.
- Deliverable: an admin can staff their whole team into Mustard and see everyone's inbox connection
  health at a glance.

PHASE 5 — Dashboard, Reporting & Motion Polish Pass
- Build the main Dashboard with animated KPI counters (sent, opens, replies, meetings booked,
  pipeline value) driven by aggregation docs (not live full-collection counts).
- Build the sequence-level and rep-level reporting views.
- Do a full motion pass: ensure every list, table, modal, and stage transition in the app uses the
  shared GSAP hooks consistently; add the landing/marketing page with ScrollTrigger storytelling.
- Run a `prefers-reduced-motion` audit across the whole app.
- Deliverable: a cohesive, fast, motion-rich product ready for real usage.

============================================================
QUALITY BAR / GUARDRAILS
============================================================
- Every Firestore collection must have security rules written alongside the feature that creates it
  — do not defer security rules to "later."
- Every async operation the user is waiting on needs a real, data-backed progress/loading state —
  no fake spinners with no underlying signal.
- No feature is "done" until it matches its corresponding row(s) in 02-User-Journey-Mustard.md.
- Prefer server-side (Cloud Functions) execution for anything touching Google API tokens — never
  expose refresh tokens or call Gmail send directly from the client.
- Write TypeScript types once per collection and import them everywhere — no ad-hoc inline shapes
  for the same entity in multiple files.
- After each phase, pause and summarize what was built, what's stubbed, and what you need from me
  (e.g., real Firebase project credentials, a Google Cloud project with Gmail/People APIs enabled)
  before continuing.

Start with PHASE 0 now. Ask me for any Firebase/Google Cloud project credentials you need before
attempting to connect to real services — scaffold with placeholders/env vars in the meantime.
```

---

## Notes for You Before Running This

- **Google Cloud Console setup you'll need to do yourself first (or in Phase 0/1):**
  1. Create a Google Cloud project, enable the **Gmail API** and **People API**.
  2. Configure the **OAuth consent screen** (Internal, if restricting to your Workspace domain, or External with verification for broader use).
  3. Create OAuth 2.0 Client credentials (Web application type) with your Firebase Auth redirect URIs authorized.
  4. Set up **Cloud Pub/Sub** for Gmail push notifications (`users.watch`) ahead of Phase 3.
- **Firebase setup**: create the Firebase project, enable Authentication (Google provider), Firestore (production mode), Cloud Functions (2nd gen, requires Blaze plan), and Cloud Storage.
- Keep `01-PRD-Mustard.md` and `02-User-Journey-Mustard.md` in the repo root (or wherever your coding agent reads project context from) so it can be referenced throughout the build, not just at kickoff.