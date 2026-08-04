# Mustard — User Journey Map

This document walks through the primary end-to-end journeys a user takes through Mustard, from first signup to running an active cold email campaign. Each journey notes the **screen**, **user action**, **system response**, and **motion/animation notes** (GSAP) so design and engineering stay in sync.

---

## Journey 1 — First-Time Signup & Google Workspace Connection

| Step | Screen | User Action | System Response | Motion Notes |
|---|---|---|---|---|
| 1 | Landing page | Clicks "Get Started" | Routes to `/signup` | ScrollTrigger-based hero animation on landing; button has magnetic hover effect |
| 2 | Signup | Clicks "Continue with Google" | Firebase Auth Google popup opens | Button pulses subtly on load to draw the eye |
| 3 | Google OAuth consent | Authorizes basic profile scopes | Firebase creates user + `organizations/{orgId}/users/{uid}` doc; if first user in domain, auto-assigned **Admin** role | Loading state: animated gradient bar |
| 4 | Onboarding — Step 1 of 3 | Names their organization/workspace | Creates `organizations/{orgId}` doc | Staggered fade-in of form fields, GSAP timeline |
| 5 | Onboarding — Step 2 of 3: **Connect Inbox** | Clicks "Connect Gmail" | Triggers incremental OAuth requesting `gmail.send`, `gmail.readonly`, offline access | Card flips (GSAP Flip plugin) to reveal permission explainer before redirect |
| 6 | Google consent screen (Gmail scopes) | Grants permission | Refresh token captured server-side (Cloud Function), encrypted, stored in `tokens/{uid}`; connection status set to "Connected" | On return, checkmark icon animates in with a scale+glow burst |
| 7 | Onboarding — Step 3 of 3 | Chooses to import contacts now or later | If "later," skips to dashboard | Progress dots animate to completed state |
| 8 | Dashboard (empty state) | Lands on empty CRM | Sees animated empty-state illustration + CTA "Add your first contacts" | Particle/grid background animates subtly in loop |

**Key edge cases:** user denies Gmail scope → banner persists "Inbox not connected — cold email sending disabled" with a retry CTA; domain admin can see per-teammate connection status on the Team page.

---

## Journey 2 — Adding Contacts Manually (One by One)

| Step | Screen | User Action | System Response | Motion Notes |
|---|---|---|---|---|
| 1 | Contacts list | Clicks "+ Add Contact" | Slide-over panel opens from the right | GSAP slide+ease-out panel entrance, backdrop blur fades in |
| 2 | Add Contact form | Types email | Real-time duplicate check against Firestore (debounced query) | Inline shake animation + red glow if duplicate found |
| 3 | Add Contact form | Fills name, company, title, tags | Autocomplete suggests existing companies | Field-by-field stagger reveal as user progresses (progressive disclosure) |
| 4 | Add Contact form | Clicks "Save Contact" | Contact doc created in Firestore; activity timeline seeded with "Contact created" event | Panel slides out; new row animates into the contacts table with a highlight flash |
| 5 | Contacts list | — | New contact appears at top, briefly highlighted | Row insert uses FLIP animation so existing rows smoothly shift down |

---

## Journey 3 — Bulk Import via CSV / Excel

| Step | Screen | User Action | System Response | Motion Notes |
|---|---|---|---|---|
| 1 | Contacts list | Clicks "Import" | Opens Import modal | Modal scales in from center with slight overshoot easing |
| 2 | Import — Upload | Drags a `.csv` or `.xlsx` file onto dropzone | Client-side quick validation (file type/size); file uploaded to Cloud Storage; `importJobs` doc created | Dropzone border animates as a glowing dashed outline while dragging |
| 3 | Import — Column Mapping | Reviews auto-detected mapping (Email → email, First Name → firstName, etc.) | User can override mapping via dropdowns per column; unmapped columns default to custom fields | Column cards animate in with a staggered cascade |
| 4 | Import — Validation Preview | Clicks "Validate" | Cloud Function parses file, flags invalid emails, missing required fields, duplicate rows | Live counter animates up: "1,204 valid · 12 warnings · 3 errors" |
| 5 | Import — Confirm | Reviews summary, clicks "Import 1,204 Contacts" | Cloud Function batch-writes contacts in chunks; `importJobs` doc updates progress | Circular progress ring animates in real time via Firestore listener |
| 6 | Import — Complete | — | Toast: "Import complete — 1,204 added, 8 skipped as duplicates" + downloadable error report | Confetti-style particle burst (subtle, on-brand, not cartoonish) on success |
| 7 | Contacts list | Optionally clicks "Enroll all imported contacts in a sequence" | Routes to Sequence Enrollment flow with this segment pre-filtered | — |

**Key edge cases:** malformed file → clear error state with example template download; file with 25k+ rows → job runs asynchronously, user can navigate away and gets a completion notification.

---

## Journey 4 — Building a Cold Email Sequence

| Step | Screen | User Action | System Response | Motion Notes |
|---|---|---|---|---|
| 1 | Sequences | Clicks "New Sequence" | Opens Sequence Builder | Full-page transition with GSAP crossfade + slight vertical parallax |
| 2 | Sequence Builder — Step 1 | Names sequence, selects sender identity (their connected Gmail) | Sequence doc created in draft state | — |
| 3 | Sequence Builder — Timeline | Adds Step 1 (Day 0): writes subject + body using `{{first_name}}`, `{{company}}` tokens | Live preview pane renders with sample contact data | Token chips have a subtle glow/pulse when inserted into the editor |
| 4 | Sequence Builder — Timeline | Clicks "+ Add Step," sets "Day 3, if no reply" | New step node appears on the visual timeline, connected by an animated line to the previous step | Timeline draws itself with an SVG line-drawing animation (GSAP DrawSVG-style) |
| 5 | Sequence Builder — Settings | Sets sending window (9am–5pm recipient time), daily cap (40/day/mailbox) | Validated against connected mailbox's existing load | — |
| 6 | Sequence Builder — Enroll | Selects a saved segment or the just-imported contact list | Enrollment docs created under `sequences/{id}/enrollments` | Avatars of enrolled contacts animate into a stacked pile with a count badge |
| 7 | Sequence Builder — Review | Sees missing-token warning if any contact lacks `{{company}}` | Launch button disabled until resolved | Warning banner shakes gently once to draw attention, doesn't repeat (avoids annoyance) |
| 8 | Sequence Builder | Clicks "Launch Sequence" | Sequence status → active; `onSequenceTick` function begins evaluating due sends | Launch button morphs into a loading rocket/orbit micro-animation, then settles into "Active" pill |

---

## Journey 5 — Sequence Runs & Reply Handling (Mostly Automated)

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | System (scheduled) | `onSequenceTick` runs every 5–15 min | Finds enrollments due for next step, checks mailbox daily cap, sends via Gmail API as the rep |
| 2 | System | Email delivered | `emailEvents` doc logged (`type: sent`); contact's activity timeline updated |
| 3 | Recipient | Opens email | Tracking pixel hits `trackOpen` function | `emailEvents` doc logged (`type: open`); dashboard KPI animates upward on next view |
| 4 | Recipient | Clicks a link | Redirect via `trackClick` function | `emailEvents` doc logged (`type: click`) |
| 5 | Recipient | Replies in-thread | Gmail push notification (Pub/Sub) triggers reply-handling function | Enrollment auto-paused; deal stage moved from "Contacted" → "Replied"; rep notified in-app |
| 6 | Rep | Opens Dashboard | Sees "3 new replies" notification | Notification bell has a bounce-in animation with a subtle glow ring |
| 7 | Rep | Clicks into contact | Views full thread context + CRM activity timeline in one place | Timeline items stagger in from bottom, most recent first |

---

## Journey 6 — Team & User Management

| Step | Screen | User Action | System Response | Motion Notes |
|---|---|---|---|---|
| 1 | Team Settings | Admin clicks "Invite Teammate" | Modal opens with single email input | Modal scale-in |
| 2 | Team Settings | Enters email, selects role (Rep/Manager), clicks "Send Invite" | Firebase Auth invite + `users` doc created in `invited` state | Row appears in "Pending Invites" list with a soft pulse until accepted |
| 3 | Team Settings — Bulk | Admin clicks "Bulk Invite via CSV" | Same importer engine as contacts, mapped to name/email/role | Identical progress-ring pattern as contact import for consistency |
| 4 | New teammate | Receives invite email, signs in with Google | Account activated, prompted through the same Onboarding Journey 1 (steps 2–3) to connect their own inbox | — |
| 5 | Admin | Views Team page | Sees connection status per teammate (Connected / Not Connected / Needs Reauth) | Status dot has a soft breathing glow when "Connected" |
| 6 | Admin | Deactivates a departing rep | Prompted to reassign their contacts/deals to another rep | Reassignment picker slides in as a secondary panel |

---

## Cross-Cutting Motion Principles (Applies to All Journeys)

- **Entrances**: staggered reveals (0.05–0.08s offset per item), never more than ~400ms total for a list of typical length.
- **State changes** (row added/removed, stage moved): FLIP-based reflow so nothing "jumps."
- **Loading states**: never a bare spinner — use skeleton shimmer or progress-ring tied to real Firestore progress data where possible.
- **Feedback**: success = brief glow/scale pulse in brand accent color; error = gentle shake, never harsh red flash.
- **Accessibility**: all animations respect `prefers-reduced-motion: reduce` by falling back to instant/opacity-only transitions.