# Product Requirements Document (PRD)
## Product: Mustard — CRM & Cold Email Platform

**Version:** 1.0
**Status:** Draft for Build
**Stack:** Next.js (App Router) + Firebase (Auth, Firestore, Functions, Storage) + Google Workspace APIs (Gmail, People, OAuth 2.0)

---

## 1. Summary

Mustard is a unified CRM and cold-email outreach platform built for small-to-mid-size sales teams operating on Google Workspace. It lets teams manage contacts and pipelines, import contacts at scale, and run multi-step cold email sequences sent directly from the team's own Gmail/Workspace accounts — with open/click/reply tracking, deliverability-safe sending, and a highly polished, motion-rich interface.

The two pillars:
1. **CRM** — contacts, companies, deals/pipeline, activity timeline, notes, tasks.
2. **Cold Email Engine** — sequences, templates, personalization tokens, scheduling, warmup-aware sending through connected Google Workspace accounts, and reply/bounce detection that automatically updates CRM records.

---

## 2. Goals & Non-Goals

### 2.1 Goals
- Let a user connect their Google Workspace account (Gmail) in under 2 minutes via OAuth.
- Allow contacts to be added one-by-one via a form, or in bulk via CSV/XLSX upload with column mapping and de-duplication.
- Allow creation of multi-step, time-delayed cold email sequences with branching on reply/no-reply.
- Send emails that appear to come from the user's real Gmail address (not a third-party domain), preserving deliverability and enabling native Gmail thread continuity.
- Track opens, clicks, replies, bounces, and unsubscribes per contact and per sequence step.
- Provide a CRM pipeline view (Kanban) that automatically reflects email engagement (e.g., "Replied" moves a deal to "Interested").
- Deliver an interface that feels premium, fast, and "alive" — GSAP-driven transitions, not static forms.
- Be usable by a single founder or a team of up to ~20 reps sharing one Workspace domain.

### 2.2 Non-Goals (v1)
- No support for non-Google email providers (Outlook/SMTP) in v1 — architecture should allow it later.
- No built-in dialer/calling.
- No AI-generated email copywriting in v1 (may be v2).
- No native mobile app (responsive web only).
- No marketing-site-style analytics/BI suite beyond campaign/pipeline reporting.

---

## 3. Target Users & Personas

| Persona | Description | Primary Need |
|---|---|---|
| **Founder-led sales (Primary)** | Solo founder or small biz owner doing their own outbound | Fast contact import, fast sequence setup, doesn't want to think about deliverability |
| **SDR / Sales Rep** | Works inside a team, owns a slice of the pipeline | Clear task queue, personalized sending, reply tracking |
| **Sales Manager / Admin** | Owns Workspace domain, manages team & data | User management, CSV imports, visibility across all reps' pipelines |

---

## 4. Core Features

### 4.1 Authentication & Google Workspace Connection
- Firebase Auth using **Google Identity Provider** (`GoogleAuthProvider`), scoped to Workspace accounts.
- On first login, request **incremental OAuth scopes** for:
  - `gmail.send` (send mail as the user)
  - `gmail.readonly` or `gmail.modify` (detect replies/bounces, thread sync)
  - `contacts.readonly` (optional import from Google Contacts)
  - `userinfo.email`, `userinfo.profile`
- Store refresh tokens **encrypted** in Firestore (or Firebase Secret Manager-backed collection), never exposed to the client.
- Connection status indicator per user: Connected / Needs Reauth / Disconnected.
- Support **domain-wide** admin view: a Workspace admin can see which teammates have/haven't connected their inbox.
- Token refresh handled via a Cloud Function that runs on a schedule and on-demand before sends.

### 4.2 Contact & Company Management (CRM Core)
- **Contact object**: name, email(s), phone, title, company, LinkedIn, tags, owner (rep), lifecycle stage, custom fields.
- **Company object**: name, domain, industry, size, linked contacts.
- **Add contact — Method 1: Manual**
  - Slide-over form with animated field reveal, inline validation, duplicate-email detection against existing contacts.
- **Add contact — Method 2: CSV/XLSX Bulk Import**
  - Drag-and-drop upload (accepts `.csv`, `.xlsx`, `.xls`).
  - Parsing: SheetJS (xlsx) for Excel, PapaParse for CSV, both client-side pre-check then server-side (Cloud Function) authoritative parse.
  - **Column mapping step**: auto-detect common headers (email, first name, last name, company, phone) with a manual override UI; unmapped columns can be stored as custom fields.
  - **Validation pass**: flags invalid emails, missing required fields, duplicate rows within file, and duplicates against existing DB — before committing.
  - **Import summary**: X added, Y skipped (duplicates), Z errors, downloadable error report.
  - Large files processed via a Cloud Function / Firestore batched writes (chunks of 400–500 docs) to respect Firestore batch limits; progress shown via a live progress bar (Firestore doc listener).
- **Deduplication rule**: primary key = normalized email address (lowercase, trimmed). Optional secondary fuzzy-match on name+company for warning (not auto-merge).
- **Deals / Pipeline**: Kanban board (e.g., New → Contacted → Replied → Meeting Booked → Won/Lost), drag-and-drop with GSAP flip animations, stage-change automation hooks.
- **Activity Timeline**: unified feed per contact — emails sent, opens, clicks, replies, manual notes, tasks, stage changes.

### 4.3 Cold Email Sequences
- **Template builder**: rich text + personalization tokens (`{{first_name}}`, `{{company}}`, `{{custom_field}}`), live preview pane.
- **Sequence builder**: visual step timeline — Step 1 (Day 0), Step 2 (Day 3 if no reply), etc. Branch logic: stop sequence on reply/bounce/unsubscribe.
- **Sending identity**: sequence is tied to one or more connected Workspace sender accounts; supports rotating senders across a team for volume/deliverability.
- **Scheduling & throttling**: sending windows (e.g., 8am–6pm recipient local time or sender time zone), daily send caps per mailbox (deliverability safety), randomized jitter between sends.
- **Personalization at scale**: token substitution validated pre-send; sequence cannot launch if required tokens are missing for any enrolled contact (surfaced as a blocking warning).
- **Enrollment**: add contacts to a sequence individually, via saved segment/filter, or directly from CSV import flow ("import & enroll").
- **Reply detection**: Cloud Function polls/uses Gmail push notifications (Pub/Sub via Gmail `watch`) to detect replies in-thread and auto-pause the contact's sequence + update CRM stage.
- **Tracking**: open tracking (invisible pixel), click tracking (link wrapping/redirect through our domain), reply detection, bounce detection (via Gmail delivery status / NDR parsing), unsubscribe link + suppression list.
- **Reporting dashboard**: per sequence — sent, delivered, open rate, reply rate, click rate, bounce rate, meetings booked; per rep leaderboard.

### 4.4 Team & User Management
- Roles: **Owner/Admin**, **Manager**, **Rep**.
- Admin can invite users by email (Firebase Auth invite flow) — added one by one via an "Invite teammate" modal.
- Admin can also **bulk-invite users via CSV/XLSX** (same importer engine as contacts, different schema: name, email, role).
- Per-user Google Workspace connection is independent — each rep authorizes their own inbox; admin cannot send "as" a rep without that rep's consent/token.
- Deactivation/reassignment of a departing rep's contacts to another owner.

### 4.5 Design & Interaction Requirements
- Overall aesthetic: **dark-mode-first, aggressively futuristic** — think glassmorphism + neon gradient accents + fine grid/particle backgrounds, sharp modern typography.
- **GSAP-driven motion** throughout:
  - Page/route transitions (GSAP + Next.js App Router transitions).
  - Kanban card drag with physics-like easing and FLIP-based reflow.
  - Animated number counters on dashboard KPIs (opens, replies, pipeline value).
  - Staggered list/table row reveal on data load.
  - Magnetic/hover-responsive buttons and nav items.
  - Animated progress indicators for CSV import and sequence sending status.
  - Scroll-triggered reveals on marketing/landing page (ScrollTrigger plugin).
- Motion should feel premium and intentional, not gratuitous — respect `prefers-reduced-motion`.
- Fully responsive; primary usage is desktop, but core CRM views must degrade gracefully on tablet.

---

## 5. Technical Architecture (High Level)

### 5.1 Frontend
- **Next.js 14+ (App Router)**, TypeScript.
- **Tailwind CSS** for styling + design tokens (dark theme, neon accent palette).
- **GSAP** (core + `ScrollTrigger`, `Flip`, `Draggable` plugins) for animation.
- **Zustand** or React Context for lightweight client state (auth session, active workspace).
- **TanStack Table** for contact/company data grids; **TanStack Query** or Firestore real-time listeners for data sync.
- **react-dropzone** for file uploads; **PapaParse** (CSV) + **SheetJS/xlsx** (Excel) for parsing.

### 5.2 Backend / Data
- **Firebase Auth** — Google provider, custom claims for roles (`admin`, `manager`, `rep`).
- **Firestore** — primary datastore. Suggested top-level collections:
  - `organizations/{orgId}`
  - `organizations/{orgId}/users/{userId}`
  - `organizations/{orgId}/contacts/{contactId}`
  - `organizations/{orgId}/companies/{companyId}`
  - `organizations/{orgId}/deals/{dealId}`
  - `organizations/{orgId}/sequences/{sequenceId}`
  - `organizations/{orgId}/sequences/{sequenceId}/enrollments/{contactId}`
  - `organizations/{orgId}/emailEvents/{eventId}` (sent/open/click/reply/bounce)
  - `organizations/{orgId}/importJobs/{jobId}`
  - `tokens/{userId}` (encrypted Google OAuth refresh tokens — locked-down security rules, server-only access)
- **Cloud Functions (2nd gen)**:
  - `onSequenceTick` (scheduled, e.g. every 5–15 min): finds due sends, respects throttling, calls Gmail API.
  - `onImportJobCreated`: parses uploaded file from Cloud Storage, validates, batch-writes contacts, updates job progress doc.
  - `onGmailPushNotification` (Pub/Sub, via Gmail `watch`): detects replies/bounces, updates emailEvents + pauses enrollments + updates deal stage.
  - `refreshGoogleTokens` (scheduled): proactively refreshes tokens nearing expiry.
  - `trackOpen` / `trackClick` (HTTPS functions): pixel and redirect endpoints.
- **Cloud Storage**: raw uploaded CSV/XLSX files, generated error reports.
- **Firestore Security Rules**: org-scoped access control; only Cloud Functions (via Admin SDK) can read/write the `tokens` collection.

### 5.3 Google Workspace Integration Detail
- OAuth 2.0 via **Google Cloud Console project** with Gmail API + People API enabled.
- Use **`gmail.users.messages.send`** with raw MIME (`Content-Type: message/rfc822`, base64url-encoded) so sent mail appears natively in the rep's Gmail "Sent" and the recipient's thread — preserving deliverability and enabling natural reply-in-thread behavior.
- Use **`gmail.users.watch`** + Cloud Pub/Sub to receive near-real-time notifications of new mail (for reply/bounce detection) rather than polling, to minimize quota use and latency.
- Respect Gmail sending limits per Workspace account (quota-aware throttling logic in `onSequenceTick`).

---

## 6. Non-Functional Requirements

- **Security**: OAuth tokens encrypted at rest; strict Firestore security rules; org-level data isolation (multi-tenant by `orgId`); audit log of admin actions.
- **Performance**: contact table virtualized for 10k+ rows; CSV import handles files up to 25k rows without blocking the UI.
- **Reliability**: sequence sending must be idempotent (no duplicate sends on function retry) — use a `sendAttemptId` guard per enrollment step.
- **Compliance**: unsubscribe link on every cold email, suppression list enforced org-wide, CAN-SPAM-style footer (physical address / org name) configurable per org.
- **Observability**: structured logging in Cloud Functions; import job and sequence send failures surfaced in-app, not just in logs.

---

## 7. Success Metrics

- Time from signup → first Google account connected: **< 2 minutes**.
- Time from CSV upload → contacts fully imported (1,000 rows): **< 60 seconds**.
- Time from sequence "Launch" click → first email sent: **< 5 minutes** (respecting send window).
- Reply detection latency: **< 5 minutes** from actual reply.
- Zero duplicate-send incidents in QA testing.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Gmail sending limits / spam flags | Per-mailbox daily caps, jitter, warmup guidance, monitor bounce rate and auto-pause sequence if bounce rate spikes |
| OAuth token expiry/revocation mid-sequence | Scheduled refresh function + in-app "reconnect" banner + sequence auto-pauses gracefully, resumes on reconnect |
| Large CSV imports timing out | Move parsing/writing to Cloud Functions with chunked batched writes + job progress doc, not client-side |
| Firestore read/write cost at scale | Denormalize activity counts, use aggregation docs for dashboard KPIs instead of live counting queries |
| Over-the-top animation hurting usability | Motion budget guidelines in design system; respect `prefers-reduced-motion`; keep data-entry forms low-latency despite motion |

---

## 9. Out of Scope for v1 (Backlog)
- Outlook / SMTP sending support
- AI-assisted copywriting and reply suggestions
- Native mobile apps
- Multi-channel outreach (LinkedIn, SMS)
- Advanced BI/reporting exports