# Data inventory

**This is the working source for `docs/legal/privacy.md`, for Apple's App Privacy questionnaire, and
for Google Play's Data Safety form. It is not published anywhere.** The privacy policy is derived
from it, not the other way round — if the app starts storing something new, add it here first.

Derived by reading `firestore.rules` and `storage.rules` end to end, plus the write sites in
`hooks/` and `contexts/AuthContext.tsx`. Those rules are the honest answer to "who can read this",
because they are the only thing enforcing it: there is no server of our own.

> **Needs a human legal review before the policy built on it is published.** It is complete and
> accurate as an engineering document; it is not legal advice.

---

## 1. Governing law, and two parties in one record

GreenPulse is operated from **New South Wales, Australia**, so the documents are written for the
**Privacy Act 1988 (Cth)**, the **Australian Privacy Principles** (APPs) and the **Australian Consumer
Law**. They were first drafted for UK/EU GDPR and rewritten on 2026-09-15; nothing GDPR-specific
remains except a short "if you are outside Australia" section in the policy.

Australian privacy law has no controller/processor split, so the GDPR framing was removed rather than
translated. What survives is the fact underneath it, which a generic consumer template still gets
wrong:

| | Whose data | Who decides what is recorded |
|---|---|---|
| **Account data** — the fact that you have an account, your email, your password, your role | The person signing up | We do. |
| **Training data** — sessions, sets, loads, templates, targets, media, messages | A Client, mostly recorded *for* their Trainer | The Trainer. We hold it and are accountable for how GreenPulse handles it. |

A personal trainer recording a client's health information may have Privacy Act obligations of their
own (as a provider of a health service). `terms.md` section 11 puts the notice-and-consent duties on
the Trainer, and our security, breach and access commitments on us.

**The small business exemption is not relied on.** Businesses under A$3M turnover are generally
exempt from the Privacy Act, but not one that provides a health service and holds health
information — and a service that records someone's training to maintain or improve their fitness may
well be one. The documents treat GreenPulse as covered. Confirming that is the first question for the
legal review.

## 2. Sensitive information

Sessions, sets, loads and progress media are **health information** about an identifiable person,
which the Privacy Act classes as **sensitive information**. That raises the bar in three concrete
places:

- collecting it needs **consent** (APP 3.3), given at registration and withdrawable by deleting the
  account. Today that consent is a sentence above the Register button with links to both documents —
  *implied* by registering. The OAIC's guidance leans towards express consent for sensitive
  information, so a tick-box is worth putting to the legal review;
- Apple's App Privacy questionnaire has a **Health & Fitness** category, and this app is in it;
- Google Play's Data Safety form has **Health and fitness → Fitness info**, likewise.

Progress media (photos/videos of a person's body) is the most sensitive item here even though the
feature is currently switched off. See §6.

---

## 3. Firebase Authentication

Google, as our service provider.

| Item | Notes |
|---|---|
| Email address | Supplied by the user. The account identifier. |
| Password | Never stored by us or by Firestore — Firebase stores a salted hash. The app never transmits it anywhere but Firebase. |
| User ID (`uid`) | Google-generated. The key every other record hangs off. |
| Email-verified flag | Set when the user follows the verification link. |
| Account created / last sign-in timestamps | Firebase keeps these automatically. |
| IP address of sign-in requests | Firebase's own logging. We neither ask for it nor see it in the app. |

Retention: for as long as the account exists. Deleting the account deletes the Auth record
immediately and irreversibly.

## 4. Cloud Firestore

Every collection the rules define, what it holds, and who can read it. "Signed-in" means any
authenticated GreenPulse user.

### `users/{uid}` — account profile
- `name`, `email`, `role` (`trainer` | `client`), `trainerId` (a Client's Trainer), `inviteCode` (a
  Trainer's shareable code), `createdAt`.
- **Readable by the person it describes, their Trainer, and their Clients.** A Trainer can list
  profiles whose `trainerId` is them (their roster); a Client can get their own Trainer's profile.
  Nobody can list the collection beyond that. Until 2026-10 any signed-in account could list every
  profile, because registration found a Trainer by querying `users` on `inviteCode`.
- Writable and deletable only by the person it describes. `role`, `trainerId` and `inviteCode` are
  frozen after registration.

### `inviteCodes/{code}` — invite code lookup
- `trainerId` only. Written by the Trainer at registration, deleted with their account.
- Any signed-in user can **get** one by its exact code (that is how a new Client finds their
  Trainer). Nobody can **list** the collection, so knowing a code is the only way to learn whose it
  is, and the uid it reveals opens nothing on its own.

### `users/{uid}/private/signup` — signup gate scratch
- `trainerCode`: the shared trainer signup code as typed by the applicant.
- **Readable by nobody at all**, including its owner — the security rules' `get()` reads it to check
  the gate, which is the whole reason it exists. Deleted the moment registration succeeds.
- Transient. Not personal data beyond being attached to a uid.

### `sessions/{id}` — a performed workout
- `clientId`, `status`, `startedAt`, `completedAt`, `date`, `durationSeconds`, `durationMinutes`,
  `notes` (free text the Client types), `exercises[]` — each with an exercise id and its Sets
  (`weightKg`, `reps`, `distanceMeters`, `durationSeconds`), plus `templateId` / `versionId` /
  `templateName` when the Session was prescribed, and `verdict` / `diff` when it was judged.
- **Health data.** Readable by the owning Client and by the Trainer that Client is linked to, and by
  nobody else. Created, edited and deleted only by the Client.

### `workoutTemplates/{id}` and `workoutTemplates/{id}/versions/{id}` — plans
- Template: `name`, `authorId`, `currentVersionId`, `currentVersionNumber`,
  `currentVersionExerciseCount`, `createdAt`. Version: `versionNumber`, `exercises[]` with target
  sets, `createdAt`.
- Authored by a Trainer or by a Client for themselves. Readable by the author and by any Client
  assigned to it. **Never deletable by anyone** — Sessions cite the Version they ran, so deleting one
  would make a Client's own history unreadable (ADR 0002). This is why account deletion leaves
  templates behind; see §8.

### `assignments/{templateId}_{clientId}` — prescription
- `templateId`, `clientId`, `trainerId`, `timesPerWeek`, `active`, optional `targetOverrides` (that
  Client's own loads, per exercise).
- Readable by the named Client and the owning Trainer. **Never deletable** — unassigning sets
  `active: false` so past Sessions stay readable (ADR 0004).

### `customExercises/{id}` — a Trainer's own movements
- `name`, `createdBy`, `fields[]`. Readable by the Trainer who created it and by their Clients.
  Deletable by its creator.

### `chats/{clientId}_{trainerId}` and `.../messages/{id}` — messaging **(feature switched off)**
- Chat: `clientId`, `trainerId`, `lastMessage`, `lastMessageAt`. Message: `senderId`, `text`,
  `createdAt`.
- Readable only by the two participants. Messages are **immutable and undeletable** once sent.
- The tab is disabled in `app/(tabs)/_layout.tsx`, so nothing new is written today — but the rules
  still permit it and anything written during earlier testing is still there. The policy must
  describe what the rules allow, not just what the UI currently exposes.

### `progressMedia/{id}` and `.../comments/{id}` — photos and video **(feature switched off)**
- Media: `clientId`, `type` (`photo` | `video`), `storagePath`, `caption`, `createdAt`. Comment:
  `authorId`, text, `createdAt`.
- Readable by the owning Client and their linked Trainer. Media is deletable by the Client; comments
  are immutable.
- **Special-category, and the most sensitive item in the app.** Same "switched off, not removed"
  caveat as messaging.

### `config/trainerSignup` — the shared trainer signup code
- `code`. **No personal data.** Readable and writable by nobody through the app; only the Firebase
  console and Admin SDK reach it.

## 5. Cloud Storage

`progressMedia/{clientId}/{mediaId}` — the photo or video file itself. Readable by the owning Client
and their linked Trainer; writable and deletable by the Client. Everything else in the bucket is
denied. Feature currently switched off.

## 6. What is collected today vs. what the rules permit

| | Written today | Permitted by the rules |
|---|---|---|
| Account profile | yes | yes |
| Sessions, sets, loads, notes | yes | yes |
| Templates, versions, assignments, targets | yes | yes |
| Custom exercises | yes | yes |
| Messages | **no** — tab disabled | yes |
| Progress photos and video | **no** — tab disabled | yes |

Both disabled features are code-complete with their rules intact, so re-enabling either is a one-line
change and needs **no** change to the published policy — which is why the policy describes both.
Say the same thing on the store forms: declare Photos/Videos and Messages only once they are back on,
or declare them now and note it. Apple treats an undeclared-but-collected category as a rejection;
declaring something you do not collect is merely conservative.

## 7. Third parties and SDKs

| Who | What reaches them | When |
|---|---|---|
| **Google (Firestore)** | Every collection in §4 | Always. Hosted in **`australia-southeast1` (Sydney)** — confirmed 2026-09-15 — so training records stay onshore. |
| **Google (Firebase Auth)** | Email, password hash, sign-in timestamps and IPs (§3) | Always. Not region-selectable in Firebase Auth, so **overseas** (APP 8). |
| **Google (Cloud Storage)** | Progress media files (§5) | Only if progress media is re-enabled. Bucket `gp-client-trainer-portal.firebasestorage.app`; its location is unconfirmed — check it before re-enabling the feature, and say so in the policy if it is not Sydney. |
| **Google (YouTube)** | The viewer's IP address and which demo clip was requested | When a player **loads**, not when it plays. **Web** embeds from `youtube-nocookie.com` (`utils/videoUrl.ts`), which sets no tracking cookies until playback. **Native** cannot use that host (`components/YouTubePlayer.tsx` explains why) and loads YouTube's own iframe API, which may set identifiers on load. A third-party disclosure: we receive nothing from it. |
| **Sentry** | Error message, stack trace, app version, platform, breadcrumbs | Only if a DSN is configured — see §9. No user id, no email, no IP: `sendDefaultPii: false`. |
| **Cloudflare (Pages)** | Standard web-server request logs for `app.greenpulse.fit`: IP, user agent, path | Every page load of the web app. |
| **Apple / Google (app stores)** | Whatever the store itself records about an install | Only for the native builds, once they exist. |

No advertising SDK, no analytics SDK, no attribution SDK, no tracking across apps or websites. That
is worth stating explicitly on both store forms — Apple's "Data Used to Track You" is **none**.

## 8. What account deletion actually removes

Implemented in `utils/deleteAccount.ts`, and the limits are structural: everything runs as the
signed-in user against `firestore.rules`, because there is no server.

**Removed** — Auth record, `users/{uid}`, `users/{uid}/private/*`, every `session` the Client owns,
every `progressMedia` document they own and its Storage object, every `customExercise` a Trainer
created.

**Left behind, and disclosed to the user before they confirm:**
- Workout Templates and Versions they authored (`allow delete: if false`, ADR 0002).
- Assignments naming them (`allow delete: if false`, ADR 0004).
- Messages they sent, in the recipient's conversation (immutable once sent).
- Comments a Trainer left on their progress media (immutable; a subcollection, which Firestore does
  not remove with its parent).

Erasure of the remainder is a manual Admin-SDK job, which is why the policy names
**privacy@greenpulse.fit** for erasure requests and why that address has to be monitored.

**A Trainer who still has Clients cannot delete in-app at all.** Their Clients' profiles point at
them via `trainerId`, and the rules refuse any update that changes that field, so deleting would
strand people with no in-app repair. They are told to move their clients first or email us.

## 9. Crash reporting

Off unless `EXPO_PUBLIC_SENTRY_DSN` is set. With no DSN the SDK is never initialised and nothing is
sent — that is the state the beta ships in until the account exists. Once enabled: error message,
stack trace, app version, platform and breadcrumbs; no identity, no IP, no performance tracing
(`tracesSampleRate: 0`). A stack trace can incidentally contain a document id, which is why the
policy mentions it rather than claiming crash reports are anonymous.

## 10. Open items for Zephyr

These cannot be answered from the repo, and the documents have gaps until they are:

1. **The legal review.** Three questions for it, in order: whether the small business exemption
   applies (§1 assumes not); whether implied consent at registration is enough for health information
   or a tick-box is needed (§2); and whether sections 9 and 12 of the terms survive the unfair
   contract terms regime.
2. **Where the data lives — answered.** Firestore is `australia-southeast1`, so the policy says
   training records stay in Australia and lists what still goes overseas: Firebase Auth records,
   Sentry crash reports, Cloudflare logs, YouTube. One loose end: the Storage bucket's location, which
   only matters once progress media is switched back on (§7).
3. **Open `users` reads — fixed.** Closed to self, Trainer and Clients, with registration moved to
   an `inviteCodes/{code}` lookup (§4). Only true once the rules are deployed and
   `scripts/backfill-invite-codes.js` has run.
4. **Firebase data processing terms.** Accept Google's Cloud Data Processing Addendum in the console
   (Firebase Console → Project settings → Privacy & Security). It is also what backs "providers that
   protect information to a comparable standard" in the policy.
5. **Retention period** for an abandoned account. The policy says data is kept until the user deletes
   it; a stated maximum is better and needs a decision.
6. **Trading identity.** "Zephyr Rosin, trading as GreenPulse, New South Wales" is what the documents
   say. If the business is in another state, change it in both documents, including the governing-law
   clause. If a company is formed before launch, both documents and both store listings change.
