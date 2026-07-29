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

```bash
node scripts/validate-exercises.js          # after editing constants/exercises.json
node scripts/validate-exercises.js --stats  # ... plus facet coverage
```

There is no test runner, linter, or build step configured — `validate-exercises.js` is the only automated check. Firebase project id: `gp-client-trainer-portal`.

Config comes from `.env` (`EXPO_PUBLIC_FIREBASE_*`, see `.env.example`) and is read in `firebase/config.js`. `.env` is gitignored.

Any future data migration should be a one-off Node script in `scripts/`, run with the Admin SDK against a service account, idempotent and `--dry`-capable.

## Architecture

### Auth and routing

`app/_layout.jsx` wraps everything in `AuthProvider` and renders a `<Redirect>` returned by `useProtectedRoute()`. The guard is deliberately declarative — do not replace it with an imperative `router.replace()` in an effect; that races the navigator and produces "action not handled by any navigator" warnings.

`AuthContext` holds two things: the Firebase auth `user` and a live `onSnapshot` of `users/{uid}` as `profile`. `profile.role` is `'trainer' | 'client'`; a client also carries `trainerId`, a trainer carries a 6-char `inviteCode`. `loading` is true until *both* have settled — most screens must wait on it before reading `profile.role`.

Registration (`signUp`) creates the auth account *first*, because Firestore rules only let signed-in users query for a trainer's invite code. If the profile write or invite lookup then fails, the auth account is rolled back with `deleteUser` — keep that rollback if you touch this.

Routing is expo-router file-based with typed routes. One tab navigator serves both roles: `app/(tabs)/_layout.jsx` hides tabs per-role via `href: isTrainer ? null : undefined`. Clients see Home/Workouts/Progress; trainers see Clients; both see Messages/Profile.

### Data model (Firestore)

- `users/{uid}` — name, email, role, trainerId, inviteCode. `role` and `trainerId` are immutable after creation (enforced in rules) so nobody self-promotes to trainer.
- `workouts/{id}` — owned by a client, read-only for their trainer. The doc carries `clientId` only; the trainer's read permission is resolved by a `get()` on the client's user doc (`isLinkedTrainer` in `firestore.rules`), not by a denormalized `trainerId`.
- `chats/{clientId}_{trainerId}` + `messages` subcollection. The chat id is derived, not looked up — see `utils/chatId.js`. Messages are immutable.
- `customExercises/{id}` — trainer-owned additions to the exercise library, readable by that trainer's clients. Clients can never create them; that's enforced server-side, not just by hiding the button.
- `progressMedia/{id}` + `comments` subcollection; the file itself lives at Storage path `progressMedia/{clientId}/{mediaId}`. Comments are immutable.

`firestore.rules` and `storage.rules` are the real authorization layer and carry the reasoning in comments. Anything not explicitly matched is denied. When adding a collection, add its rules in the same change.

### Workout document shape

```js
workouts/{id} = {
  clientId, date: Timestamp, durationMinutes, notes, createdAt,
  exercises: [
    { exerciseId,          // catalog id, or `custom:{docId}`
      name,                // denormalised so history renders without a catalog lookup
      fields,              // copied from the catalog record at log time
      sets: [{ weightKg, reps, distanceMeters, durationSeconds }] }  // absent measures are null
  ]
}
```

A set only carries the keys its exercise's `fields` declares, and every absent measurement is `null` rather than `0`. `fields` is denormalised onto the logged entry so a workout still renders correctly if the catalog record is later retagged or renamed.

Reading helpers live in `utils/formatSet.js` (display) and `utils/workoutStats.js` (volume/totals). Volume is loaded work only — `reps × weightKg`; bodyweight and timed work score 0 there and are surfaced as separate totals, because summing them would mix units.

### Exercise repository

`constants/exercises.json` is a bundled catalog of ~317 records. Each has `fields` (which measurements a set takes — `weightKg`/`reps`/`distanceMeters`/`durationSeconds`), faceted `tags`, and an optional `videoUrl` (an https link to a how-to demo, surfaced as "Watch how-to" in the picker; absent on most records and that's fine). Nothing else: there are deliberately **no** `typicalSets`/`typicalReps`, because a set starts empty and is prefilled from that client's own last performance (`utils/exerciseHistory.js`) rather than from a generic prescription, and no `aliases` — the spelling variants earned their keep while importing the spreadsheets and nothing after it.

Logging is **select-only**: clients pick from the catalog + their trainer's custom exercises, they cannot type a free-text exercise name.

The five tag facets are closed vocabularies defined in `scripts/exerciseVocab.js`:

| Facet | Meaning |
|---|---|
| `muscle:` | what it trains |
| `pattern:` | movement pattern (`squat`, `hinge`, `horizontal-pull`, `anti-rotation`, …) |
| `modality:` | how it's trained (`resistance`, `cardio`, `mobility`, `stretch`, `yoga`, `plyometric`, `isometric`, `balance`) |
| `role:` | job in a session (`compound`, `accessory`, `isolation`, `power`, `potentiation`, `core`, `prehab`, `warmup`, `cooldown`, `conditioning`) |
| `equipment:` | what it needs |

`role:` and `modality:` are separate on purpose — the old single `category` field conflated "compound vs isolation" with "cardio vs mobility", which made both unfilterable. They map onto the `Type` column in the trainer's program spreadsheets.

Run `node scripts/validate-exercises.js [--stats]` after editing the catalog. It enforces the schema and the closed vocabularies, and lints the naming rules: no superset prefixes (`A1.`), no durations/distances/rep counts baked into a name, no `/` either-ors or `+` combos, no abbreviations in `name`. Names are spelled out (`Single-Arm Dumbbell Row`) while ids stay abbreviated (`sa-db-row`), and the search indexes both, so either form finds the record. It exits non-zero, so it can gate a commit.

`utils/exerciseSearch.js` builds its index once at module load. A record is indexed under two labels — its name and its de-slugged id — ranked **separately** (exact > prefix > word-prefix > substring); a name match outranks an id match at equal rank, and ties break toward the shorter name so "curl" resolves to `Bicep Curl` rather than `Barbell Bicep Curl`. Coaching shorthand (`db`, `rdl`, `sa`, `wgs`, `rower`, …) is expanded and trailing plurals are stripped on **both** sides of the comparison, which is what lets "bicep curls" find `Bicep Curl` now that plural aliases are gone. Custom exercises are indexed separately by the caller and passed in as `extra`; their ids are namespaced `custom:{docId}` so they can't collide.

Unused measurement fields are stored as `null`, never `0` — "no weight" must stay distinguishable from "lifted 0 kg".

### Data-fetching convention

Every collection read is a hook in `hooks/` that owns one `onSnapshot` subscription and returns `{ data, loading }`, cleaning up on unmount and resetting when its id argument is null. Sorting is generally done client-side to avoid needing composite Firestore indexes (`firestore.indexes.json` is deliberately near-empty). Follow this shape for new reads rather than calling Firestore from a screen.

### UI conventions

Components are default-export function components in `components/`, styled with `StyleSheet.create` and no styling library. Themed primitives (`ThemedView`, `ThemedText`, `ThemedButton`, `ThemedCard`, `ThemedTextInput`, `ThemedLogo`) each call `useColorScheme()` and index `Colors[colorScheme] ?? Colors.light` from `constants/Colors.js` — use them instead of raw RN primitives so light/dark keeps working. `Colors.primary` is intentionally dark enough for white button text; the brighter accent greens are icon/highlight-only.

Auth errors are mapped to human copy through `utils/firebaseErrors.js` — route new auth failures through it rather than surfacing raw Firebase codes.

Tabs whose route is a folder (`clients`, `workouts`, `messages`, `progress`) set `headerShown: false` on their `Tabs.Screen`, because the nested `Stack` renders its own header — leaving both on shows the title twice.

How-to demos are YouTube links, which `expo-video` can't play (it wants a direct media file), so `components/VideoEmbed.jsx` embeds YouTube's own iframe player: a `WebView` on native, a real `<iframe>` on web, since `react-native-webview` has no web build. URL parsing lives separately in `utils/videoUrl.js` so it's testable without a React Native runtime. `ExerciseInfoModal` is a stacked `Modal` rather than a pushed route on purpose — `ExercisePicker` is itself a `Modal`, and on native a pushed screen would open *behind* it.

## Working style in this repo

History is a linear sequence of `Phase N: <feature>` commits on feature branches (`phase-N-...`) merged into `main`. Comments in this codebase explain *why* a non-obvious choice was made (rule tradeoffs, race conditions, schema tolerance) rather than restating the code — match that when adding new ones.
