# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GreenPulse — an Expo / React Native app (iOS, Android, web) that pairs personal trainers with their clients. Firebase (Auth + Firestore + Storage) is the entire backend; there is no server of our own. JavaScript only (`.jsx`/`.js`), no TypeScript.

## Commands

```bash
npm start              # expo start (dev server, all platforms)
npm run web            # expo start --web  (the usual dev loop; see .claude/launch.json, port 8081)
npm run ios / android

firebase deploy --only firestore:rules      # after editing firestore.rules
firebase deploy --only storage              # after editing storage.rules
```

There is no test runner, linter, or build step configured. Firebase project id: `gp-client-trainer-portal`.

Config comes from `.env` (`EXPO_PUBLIC_FIREBASE_*`, see `.env.example`) and is read in `firebase/config.js`. `.env` is gitignored.

Data migrations are one-off Node scripts in `scripts/`, run with the Admin SDK against a service account, and are idempotent + `--dry`-capable:

```bash
GOOGLE_APPLICATION_CREDENTIALS=<sa.json> node scripts/migrate-workouts-v2.js --project gp-client-trainer-portal --dry
node scripts/migrate-exercises-v2.js --dry --report      # rewrites constants/exercises.json in place
```

## Architecture

### Auth and routing

`app/_layout.jsx` wraps everything in `AuthProvider` and renders a `<Redirect>` returned by `useProtectedRoute()`. The guard is deliberately declarative — do not replace it with an imperative `router.replace()` in an effect; that races the navigator and produces "action not handled by any navigator" warnings.

`AuthContext` holds two things: the Firebase auth `user` and a live `onSnapshot` of `users/{uid}` as `profile`. `profile.role` is `'trainer' | 'client'`; a client also carries `trainerId`, a trainer carries a 6-char `inviteCode`. `loading` is true until *both* have settled — most screens must wait on it before reading `profile.role`.

Registration (`signUp`) creates the auth account *first*, because Firestore rules only let signed-in users query for a trainer's invite code. If the profile write or invite lookup then fails, the auth account is rolled back with `deleteUser` — keep that rollback if you touch this.

Routing is expo-router file-based with typed routes. One tab navigator serves both roles: `app/(tabs)/_layout.jsx` hides tabs per-role via `href: isTrainer ? null : undefined`. Clients see Home/Workouts/Progress; trainers see Clients; both see Messages/Profile.

### Data model (Firestore)

- `users/{uid}` — name, email, role, trainerId, inviteCode. `role` and `trainerId` are immutable after creation (enforced in rules) so nobody self-promotes to trainer.
- `workouts/{id}` — owned by a client, read-only for their trainer. `trainerId` is **denormalized onto the doc** at write time so reads cost no `get()`; rules verify it against the client's real trainer on write instead.
- `chats/{clientId}_{trainerId}` + `messages` subcollection. The chat id is derived, not looked up — see `utils/chatId.js`. Messages are immutable.
- `customExercises/{id}` — trainer-owned additions to the exercise library, readable by that trainer's clients. Clients can never create them; that's enforced server-side, not just by hiding the button.
- `progressMedia/{id}` + `comments` subcollection; the file itself lives at Storage path `progressMedia/{clientId}/{mediaId}`. Comments are immutable.

`firestore.rules` and `storage.rules` are the real authorization layer and carry the reasoning in comments. Anything not explicitly matched is denied. When adding a collection, add its rules in the same change.

### Workout schema and the v1/v2 split

`utils/workoutSchema.js` is **the only file that knows about workout document shapes**. v2 is `workout.entries[] -> entry.sets[]` with `set.type`/`rpe`/`tempo` and `set.weightKg`; v1 was `exercises[]` and `set.weight`. Every read path goes through `entriesOf` / `setsOf` / `weightOf` / `setTypeOf` so legacy tolerance can be deleted in one edit once `scripts/migrate-workouts-v2.js` has run everywhere. Do not reach into `workout.entries` directly from a screen.

Volume rules live here too: drop sets and failure sets count as working sets; only warm-ups are excluded (`workingSets`, `isWarmup`).

Comparable legacy fallbacks marked `LEGACY:` also exist in `firestore.rules` (the `isLinkedTrainer` read branch) and `exerciseSearch.js` (`LEGACY_FIELDS_BY_TYPE`). They are all deletable together after migration.

### Exercise repository

`constants/exercises.json` is a bundled catalog; each record has `fields` (which measurements a set takes — `weightKg`/`reps`/`distanceMeters`/`durationSeconds`), faceted `tags` (`muscle:`, `pattern:`, `modality:`, `role:`, `equipment:`), `aliases`, and optional `typicalSets`/`typicalReps`. Logging is **select-only**: clients pick from the catalog + their trainer's custom exercises, they cannot type a free-text exercise name.

`utils/exerciseSearch.js` builds its index once at module load and ranks exact > prefix > word-prefix > substring, expanding coaching shorthand (`db`, `rdl`, `sa`, …). Custom exercises are indexed separately by the caller and passed in as `extra`; their ids are namespaced `custom:{docId}` so they can't collide.

Unused measurement fields are stored as `null`, never `0` — "no weight" must stay distinguishable from "lifted 0 kg".

### Data-fetching convention

Every collection read is a hook in `hooks/` that owns one `onSnapshot` subscription and returns `{ data, loading }`, cleaning up on unmount and resetting when its id argument is null. Sorting is generally done client-side to avoid needing composite Firestore indexes (`firestore.indexes.json` is deliberately near-empty). Follow this shape for new reads rather than calling Firestore from a screen.

### UI conventions

Components are default-export function components in `components/`, styled with `StyleSheet.create` and no styling library. Themed primitives (`ThemedView`, `ThemedText`, `ThemedButton`, `ThemedCard`, `ThemedTextInput`, `ThemedLogo`) each call `useColorScheme()` and index `Colors[colorScheme] ?? Colors.light` from `constants/Colors.js` — use them instead of raw RN primitives so light/dark keeps working. `Colors.primary` is intentionally dark enough for white button text; the brighter accent greens are icon/highlight-only.

Auth errors are mapped to human copy through `utils/firebaseErrors.js` — route new auth failures through it rather than surfacing raw Firebase codes.

## Working style in this repo

History is a linear sequence of `Phase N: <feature>` commits on feature branches (`phase-N-...`) merged into `main`. Comments in this codebase explain *why* a non-obvious choice was made (rule tradeoffs, race conditions, schema tolerance) rather than restating the code — match that when adding new ones.
