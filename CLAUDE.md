## Project Overview

GreenPulse Client Trainer Portal is a workout tracker. Trainers prescribe workouts to their clients; clients then check off sets and exercises as they work through a session in real time. Clients can also start a self-directed session, so they can track their training without a prescribed workout.

## Current scope

The overview above is the **goal**, not the current state. Prescription does not exist yet: today
a workout is a client-authored log written in one shot at the end (`app/(tabs)/workouts/new.tsx`),
and `firestore.rules` deliberately forbids a trainer from creating one. The domain model for
prescription is settled in `CONTEXT.md` and `docs/adr/0001`–`0005`, which are **authoritative** —
read those before touching workouts, templates, or sessions.

Three shipped features are **out of scope** while the core tracking loop is built. Disable rather
than delete them — `href: null` on their tabs in `app/(tabs)/_layout.tsx`, code and rules left
intact — so re-enabling stays a one-line change. **None of that is applied yet**; all three are
still live:

- **Messaging** (`app/(tabs)/messages/`) — currently has no `href` gate at all, so it shows for
  both roles.
- **Progress media** (`app/(tabs)/progress/`, and the trainer's client-progress route).
- **Custom exercises** — `components/ExercisePicker.tsx` still sources them via
  `useCustomExercises`. Once dropped, templates draw only from `constants/exercises.json`, so
  prescribing a movement outside the catalog means editing that file and shipping a build.

Trainers have no Workouts tab today, so template authoring has no home yet.

### Known divergences between the glossary and the code

`CONTEXT.md` is authoritative and the code has not caught up. Each of these is deliberate — don't
"fix" either side to match the other without a decision:

- **Work Volume** is defined per-Exercise and never summed across Exercises, but
  `utils/workoutStats.ts` and `components/WorkoutSummaryCard.tsx` compute and display per-session
  and all-time volume totals. Those predate the term and are left as shipped on purpose; new work
  measures volume per Exercise.
- **Session** is the domain term for a performed workout, but the collection, its hook and its
  routes are all still called `workouts` (`hooks/useWorkouts.ts`, `app/(tabs)/workouts/`).
  Reconciling that is a data migration, not a rename.
- **A Client's Trainer is changeable** per the glossary, but `firestore.rules` refuses any update
  altering `trainerId`. That rule is deliberate: the same clause guards `role`, and relaxing it
  would let a client link to any trainer or promote themselves to one. Allowing a switch needs a
  gated path, not a loosened rule.

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

python scripts/find-exercise-videos.py     # search YouTube -> constants/videoCandidates.json
node scripts/promote-videos.js --dry       # preview which candidates enter the catalog
node scripts/promote-videos.js             # ... and write them in
```

## Tests and checks

There is **no test runner and no linter**. The two automated gates are `npm run typecheck` and
`node scripts/validate-exercises.js`; both exit non-zero, so either can gate a commit.

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
reads as a domain hook in `hooks/` that wraps the helper and renames `data` (`useWorkouts` returns
`workouts`). Sort client-side via the `sort` option rather than `orderBy`, so no composite index is
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

**UI.** Use `ThemedView`/`ThemedText`/`ThemedButton`/`ThemedCard`/`ThemedTextInput`/`ThemedLogo`
instead of raw RN primitives, so light/dark keeps working; they index `Colors[colorScheme]` from
`constants/Colors.ts`. Route auth failures through `utils/firebaseErrors.ts` rather than surfacing
raw Firebase codes.

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
merged into `main`.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature-slug>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
