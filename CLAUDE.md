## Project Overview

GreenPulse Client Trainer Portal is a workout tracker. Trainers prescribe workouts to their clients; clients then check off sets and exercises as they work through a session in real time. Clients can also start a self-directed session, so they can track their training without a prescribed workout.

## Current scope

The whole prescribe/perform/review loop is built: a Trainer authors Workout Templates
(`app/(tabs)/workouts/templates/`), publishes immutable Versions, and assigns them to Clients with
per-Client target loads; a Client performs a live Session against a Version or starts a
self-directed one, and each completed Session is judged *As Prescribed* or *Modified* and diffed.
The domain model behind all of it is settled in `CONTEXT.md` and `docs/adr/0001`–`0005`, which are
**authoritative** — read those before touching workouts, templates, or sessions.

Two shipped features are switched off while the core loop is finished — `href: null` on their tabs
in `app/(tabs)/_layout.tsx`, code and rules left intact, so re-enabling is a one-line change.
**Messaging** (`app/(tabs)/messages/`) and **progress media** (`app/(tabs)/progress/` plus the
trainer's client-progress route) are both gated; each carries a comment saying what switching it
back on takes, since progress was client-only and messaging was not.

**Custom exercises** are the one out-of-scope feature still live: `components/ExercisePicker.tsx`
sources them via `useCustomExercises`. Once dropped, templates draw only from
`constants/exercises.json`, so prescribing a movement outside the catalog means editing that file
and shipping a build.

### Known divergences between the glossary and the code

`CONTEXT.md` is authoritative and the code has not caught up. Both of these are deliberate — don't
"fix" either side to match the other without a decision:

- **Work Volume** is defined per-Exercise and never summed across Exercises, but
  `utils/workoutStats.ts` still totals across them: `volumeForWorkout` for the per-Session figure on
  the Trainer's Client review screen. That predates the term and is left as shipped on purpose.
  `components/WorkoutSummaryCard.tsx`, which used the same file to show a Client's this-week and
  all-time totals, is gone as of phase 12 (Signal) - not because the divergence was resolved, but
  because Signal's Today and History draw no cross-session summary at all.
- **Session** is the domain term for a performed workout. The collection and its hook now match
  (`sessions`, `hooks/useSessions.ts`), but the **routes deliberately do not**: the Workouts tab
  (`app/(tabs)/workouts/`) is named for the tab, not for the collection, and now holds both a
  Client's session history and the Trainer's `templates/` authoring routes. Renaming the folder
  would produce `sessions/templates/`, which is wrong. URL segments stay `workouts`.

## What this is

GreenPulse — an Expo / React Native app (iOS, Android, web) pairing personal trainers with their
clients. Firebase (Auth + Firestore + Storage) is the whole backend; there is no server of our own.
Firebase project id: `gp-client-trainer-portal`.

Source is TypeScript (`.tsx`/`.ts`), with the deliberate exception of `scripts/`, which stays plain
`.js` so it runs under bare `node` with no build step (`tsconfig.json` excludes it).

## Commands

```bash
npm start                # expo start (all platforms)
npm run web              # expo start --web — the usual dev loop (port 8081, see .claude/launch.json)
npm run ios / android

firebase deploy --only firestore:rules     # after editing firestore.rules
firebase deploy --only storage             # after editing storage.rules
```

Exercise catalog and its tooling:

```bash
npm run typecheck                          # tsc --noEmit; must stay clean
node scripts/validate-exercises.js         # after editing constants/exercises.json
node scripts/validate-exercises.js --stats # ... plus facet coverage
npm run gen:types                          # after editing scripts/exerciseVocab.js

npm run verify:videos                      # how-to demo coverage; offline
npm run verify:videos -- --oembed          # ... live/embeddable check, no API key
npm run verify:videos -- --online          # ... duration + channel checks (needs YOUTUBE_API_KEY)
npm run verify:videos -- --learn           # print each video's channel, to seed APPROVED_CHANNELS

python scripts/find-exercise-videos.py     # search YouTube -> constants/videoCandidates.json (gitignored)
node scripts/promote-videos.js --dry       # preview which candidates enter the catalog
node scripts/promote-videos.js             # ... and write them in
```

Against the live Firebase project, with the Admin SDK. These touch real data — **Zephyr runs
these, not the assistant**. Credentials come from `secrets/service-account.json`, pointed at by
`GOOGLE_APPLICATION_CREDENTIALS` in `.env`; `bash scripts/setup-admin-credentials.sh` walks you
through obtaining them.

```bash
node scripts/seed-test-data.js             # the five test accounts (docs/test-accounts.md)
node scripts/seed-test-data.js --reset     # ... and delete them again
node scripts/smoke-test-rules.js           # signs in as each account, asserts firestore.rules; expect 39 passed
node scripts/migrate-workouts-to-sessions.js --dry   # the workouts -> sessions rename; already run
```

## Tests and checks

There is **no test runner and no linter**. Three commands gate a commit, all exiting non-zero:
`npm run typecheck`, `node scripts/validate-exercises.js`, and `npx expo export -p web`.

- **`npx expo export -p web` is the third gate and easy to forget.** It compiles every screen
  module, where `typecheck` only checks types — it is what catches a bad import in a route nobody
  has opened. Run it before calling a branch done.
- `node scripts/smoke-test-rules.js` is not a gate (it needs the network and the seeded fixture)
  but it is the only real check on `firestore.rules`, and it is Zephyr's to run.

- Typechecking is **off the dev loop**. Metro compiles via Babel, which strips types without
  checking them, so `expo start` and Fast Refresh never invoke tsc. Running `npm run typecheck` is a
  separate, deliberate act (`incremental` is on). Don't wire it into the dev server.
- `verify-videos.js` is deliberately **not** a gate: it needs the network and an API key, so it can
  run neither offline nor in CI without a secret. It's periodic maintenance for demos that rotted.
- `npm run gen:types` is manual too, and not wired into `typecheck`. Editing `exerciseVocab.js`
  without regenerating leaves the types stale (the validator still catches bad data).
- The native video path can't be exercised from a dev machine — web takes the `<iframe>` branch and
  never loads the native library — so changes to `YouTubePlayer.tsx` need a device or simulator.

## Configuration

`.env` (gitignored; copy `.env.example`) holds `EXPO_PUBLIC_FIREBASE_*`, read in `firebase/config.ts`.
`YOUTUBE_API_KEY` there is intentionally *not* `EXPO_PUBLIC_` — only `scripts/verify-videos.js`
reads it, under bare node, and it must never be bundled into the app.

## Technology choices

| Area | Choice |
|---|---|
| Routing | expo-router, file-based, typed routes (`app.json` → `experiments.typedRoutes`) |
| Backend | Firebase JS SDK (`firebase@^12`) — Auth, Firestore, Storage. No custom server |
| State | React context + hooks. No state library |
| Styling | `StyleSheet.create` + themed primitives. No styling library |
| YouTube demos | `react-native-youtube-iframe` on native; a plain `<iframe>` on web |
| Direct media | `expo-video` on all platforms |
| Connectivity | **No connectivity library** (`expo-network`, NetInfo). Offline is derived from Firestore snapshot metadata, never from asking the OS |
| Scripts | Plain `.js` under bare node; the video harvester is Python only because yt-dlp is |

## Layout

```
app/            expo-router routes: (auth), (tabs) — one tab navigator serves both roles
components/     default-export function components
contexts/       AuthContext (auth user + live users/{uid} profile)
hooks/          useFirestoreSnapshot + one domain hook per collection
utils/          pure helpers, no React Native runtime needed
constants/      Colors.ts, exercises.json (~317 records) + its typed wrapper
types/          hand-written types; exerciseVocab.generated.ts is generated
scripts/        node/python maintenance and validation tooling
firestore.rules / storage.rules      the real authorization layer
```

## Conventions

**Data fetching.** Every Firestore read goes through `hooks/useFirestoreSnapshot.ts` —
`useFirestoreQuery` for a collection, `useFirestoreDoc` for a document. Don't call `onSnapshot` from
a hook or screen (`AuthContext` is the one documented exception). Each returns
`{ data, loading, offline, error, retry }`, owns one subscription, and cleans up on unmount. Add new
reads as a domain hook in `hooks/` that wraps the helper and renames `data` (`useSessions` returns
`sessions`). Sort client-side via the `sort` option rather than `orderBy`, so no composite index is
needed — `firestore.indexes.json` is deliberately empty.

**Offline UI.** Surface the flag with `<OfflineBanner visible={offline} onRetry={retry} />`, and wrap
it in `useOffline(...)` rather than passing a hook's `offline` straight through — most reads key off
`profile.uid`, so a failed profile leaves leaf hooks truthfully reporting "not offline".

**Routing.** The guard is declarative: `app/_layout.tsx` renders the `<Redirect>` returned by
`useProtectedRoute()`. Don't replace it with an imperative `router.replace()` in an effect — that
races the navigator. Tabs whose route is a folder set `headerShown: false`, since the nested `Stack`
renders its own header.

**TypeScript.** `strict: false` is deliberate (see the comments in `tsconfig.json`).
- Type the boundaries, infer the insides: props and exported signatures carry annotations, locals don't.
- Themed primitives **extend** RN's prop types (`ViewProps`, `TextProps`, …) rather than redeclaring `style`.
- Route params use the generic: `useLocalSearchParams<{ id: string }>()`.
- Firestore snapshot rows are annotated `any`; a real `Session`/`ProgressMedia` type is the upgrade path.
- Asset modules are declared in `types/assets.d.ts` (committed on purpose; `expo-env.d.ts` is generated).
- `firebase/config.ts` needs one `@ts-expect-error` for `getReactNativePersistence`. Don't "fix" it.

**UI.** Use the themed primitives instead of raw RN ones, so light/dark keeps working; they index
`Colors[colorScheme]` from `constants/Colors.ts`. `ThemedView`/`ThemedText`/`ThemedButton`/
`ThemedCard`/`ThemedTextInput` are the base layer; `ThemedChip`, `SectionLabel`, `ScreenSubtitle`
and `Spacer` are the shared vocabulary the screens were redesigned onto — reach for one of those
before inventing a per-screen style. No six-digit hex literal belongs outside `constants/Colors.ts`.
Route auth failures through `utils/firebaseErrors.ts` rather than surfacing raw Firebase codes.

**Exercise catalog.** Import from `constants/exerciseCatalog.ts`, never `exercises.json` directly —
a raw JSON import is inferred structurally and loses the closed tag vocabularies. `scripts/exerciseVocab.js`
is the single source of truth for those vocabularies; `types/exerciseVocab.generated.ts` is generated
from it — **do not edit it**. Store unused measurement fields as `null`, never `0`: "no weight" must
stay distinguishable from "lifted 0 kg".

**Firestore rules** are the real authorization layer and carry their reasoning in comments; anything
not explicitly matched is denied. When adding a collection, add its rules in the same change.

**Migrations**, if ever needed, are one-off Node scripts in `scripts/` run with the Admin SDK against
a service account — idempotent and `--dry`-capable.

**Comments** explain *why* a non-obvious choice was made (rule tradeoffs, race conditions, platform
quirks) rather than restating the code. Match that density when adding new ones.

**History** is a linear sequence of `Phase N: <feature>` commits, made on `phase-N-...` branches and
merged into `main`. Commits *within* a branch are plain-English sentences about what changed and for
whom — no `feat:`/`fix:` prefixes (see `git log --oneline -8`).

## Tickets

Tickets are markdown files under `.claude/tickets/`, gitignored. Status is the folder — `new/`,
`in-progress/`, `done/` — and moving a file is the only thing that changes when a ticket's state
does. Name them `NN-<slug>.md`.

**A ticket is at most 25 lines and four fields — What / Where (files, with line numbers) / Done when
(observable outcomes, not steps) / Notes (usually omit).** When it lands, append at most three lines
under `## Answer` and move it to `done/`. Longer reasoning goes where this repo already keeps it:
the commit message and why-comments in the code.

Four things are deliberately absent, because fifteen tickets proved they cost more than they
returned: **no separate plan file** (for a ticket this size the ticket is the plan — a plan document
was the single most expensive artefact in this repo's history); no comment logs, triage labels or
blocked-by graphs unless a dependency genuinely exists; **tickets touching the same screen go to one
agent in one dispatch**, since a cold-starting agent re-reads this whole file before doing the work
and fifteen separate dispatches paid that fixed cost fifteen times; and a feature splits into
**roughly 3–7 chunky tickets** — fourteen was too many.

A handoff, where a phase genuinely needs one outliving its tickets, goes in `docs/` and is **deleted
when that phase merges** — a finished handoff has no readers and goes stale silently. Don't write a
spec document at all; the tickets and the ADRs carry what one would have said.

## Domain docs

Everything under `docs/` is tracked documentation for whoever reads the code — not agent
instructions, which belong in this file. `.claude/` is the reverse: tool config, tickets and working
notes, mostly gitignored, disposable.

`CONTEXT.md` is the glossary and `docs/adr/0001`–`0005` are the settled decisions; both are
authoritative and both are short. Read the ADRs that touch what you're about to change — twenty
code comments cite them by number, so contradicting one is usually a mistake rather than a choice.
If your change does contradict an ADR, say so explicitly rather than quietly overriding it. Use the
glossary's words in code, tickets and commits, and avoid the synonyms it names.
