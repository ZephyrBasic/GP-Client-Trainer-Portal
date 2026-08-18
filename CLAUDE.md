# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GreenPulse — an Expo / React Native app (iOS, Android, web) that pairs personal trainers with their clients. Firebase (Auth + Firestore + Storage) is the entire backend; there is no server of our own. TypeScript (`.tsx`/`.ts`), with the deliberate exception of `scripts/`, which stays plain `.js` so it runs under bare `node` with no build step.

## Commands

```bash
npm start              # expo start (dev server, all platforms)
npm run web            # expo start --web  (the usual dev loop; see .claude/launch.json, port 8081)
npm run ios / android

firebase deploy --only firestore:rules      # after editing firestore.rules
firebase deploy --only storage              # after editing storage.rules
```

```bash
npm run typecheck                           # tsc --noEmit; must stay clean
npm run gen:types                           # after editing scripts/exerciseVocab.js
node scripts/validate-exercises.js          # after editing constants/exercises.json
node scripts/validate-exercises.js --stats  # ... plus facet coverage
```

```bash
python -m pip install --upgrade yt-dlp      # one-off, for the harvester below
python scripts/find-exercise-videos.py      # search YouTube for candidate demos -> videoCandidates.json
node scripts/promote-videos.js --dry        # preview which candidates would enter the catalog
node scripts/promote-videos.js              # ... and write them in
```

```bash
npm run verify:videos                       # how-to demo coverage; offline, no key needed
npm run verify:videos -- --missing          # ... plus every exercise with no demo yet
npm run verify:videos -- --oembed           # ... plus live/embeddable check on every video, NO key
npm run verify:videos -- --online           # ... plus duration + channel checks (needs YOUTUBE_API_KEY)
npm run verify:videos -- --learn            # print each video's channel, to seed APPROVED_CHANNELS
```

`--oembed` is the one to reach for routinely: YouTube's oEmbed endpoint answers 200 only for a video that is public *and* embeddable, so it catches both dead-player failures with no API key and no quota. It can't see duration or `channelId` — that still needs `--online`.

There is no test runner or linter — `npm run typecheck` and `validate-exercises.js` are the only automated checks, and both exit non-zero so they can gate a commit. Firebase project id: `gp-client-trainer-portal`.

`verify-videos.js` is deliberately **not** a commit gate: it needs the network and an API key, so it can neither run offline nor in CI without a secret. It's a periodic maintenance run for catching demos that have rotted, not something to wire into the dev loop.

Typechecking is **opt-in and off the dev loop**: Metro compiles through Babel, which strips types without checking them, so `expo start` and Fast Refresh never invoke tsc. Running `npm run typecheck` is a separate, deliberate act; `incremental` is on so repeat runs only re-check what changed. Nothing here should be wired into the dev server.

Config comes from `.env` (`EXPO_PUBLIC_FIREBASE_*`, see `.env.example`) and is read in `firebase/config.ts`. `.env` is gitignored.

Any future data migration should be a one-off Node script in `scripts/`, run with the Admin SDK against a service account, idempotent and `--dry`-capable.

## Architecture

### Auth and routing

`app/_layout.tsx` wraps everything in `AuthProvider` and renders a `<Redirect>` returned by `useProtectedRoute()`. The guard is deliberately declarative — do not replace it with an imperative `router.replace()` in an effect; that races the navigator and produces "action not handled by any navigator" warnings.

`AuthContext` holds two things: the Firebase auth `user` and a live `onSnapshot` of `users/{uid}` as `profile`. `profile.role` is `'trainer' | 'client'`; a client also carries `trainerId`, a trainer carries a 6-char `inviteCode`. `loading` is true until *both* have settled — most screens must wait on it before reading `profile.role`.

Registration (`signUp`) creates the auth account *first*, because Firestore rules only let signed-in users query for a trainer's invite code. If the profile write or invite lookup then fails, the auth account is rolled back with `deleteUser` — keep that rollback if you touch this.

Routing is expo-router file-based with typed routes. One tab navigator serves both roles: `app/(tabs)/_layout.tsx` hides tabs per-role via `href: isTrainer ? null : undefined`. Clients see Home/Workouts/Progress; trainers see Clients; both see Messages/Profile.

### Data model (Firestore)

- `users/{uid}` — name, email, role, trainerId, inviteCode. `role` and `trainerId` are immutable after creation (enforced in rules) so nobody self-promotes to trainer.
- `workouts/{id}` — owned by a client, read-only for their trainer. The doc carries `clientId` only; the trainer's read permission is resolved by a `get()` on the client's user doc (`isLinkedTrainer` in `firestore.rules`), not by a denormalized `trainerId`.
- `chats/{clientId}_{trainerId}` + `messages` subcollection. The chat id is derived, not looked up — see `utils/chatId.ts`. Messages are immutable.
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

Reading helpers live in `utils/formatSet.ts` (display) and `utils/workoutStats.ts` (volume/totals). Volume is loaded work only — `reps × weightKg`; bodyweight and timed work score 0 there and are surfaced as separate totals, because summing them would mix units.

### Exercise repository

`constants/exercises.json` is a bundled catalog of ~317 records. Each has `fields` (which measurements a set takes — `weightKg`/`reps`/`distanceMeters`/`durationSeconds`), faceted `tags`, an optional `videoUrl` (a how-to demo, shown by the info button in the picker) and an optional `clip` window on that video. Nothing else: there are deliberately **no** `typicalSets`/`typicalReps`, because a set starts empty and is prefilled from that client's own last performance (`utils/exerciseHistory.ts`) rather than from a generic prescription, and no `aliases` — the spelling variants earned their keep while importing the spreadsheets and nothing after it.

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

`utils/exerciseSearch.ts` builds its index once at module load. A record is indexed under two labels — its name and its de-slugged id — ranked **separately** (exact > prefix > word-prefix > substring); a name match outranks an id match at equal rank, and ties break toward the shorter name so "curl" resolves to `Bicep Curl` rather than `Barbell Bicep Curl`. Coaching shorthand (`db`, `rdl`, `sa`, `wgs`, `rower`, …) is expanded and trailing plurals are stripped on **both** sides of the comparison, which is what lets "bicep curls" find `Bicep Curl` now that plural aliases are gone. Custom exercises are indexed separately by the caller and passed in as `extra`; their ids are namespaced `custom:{docId}` so they can't collide.

Unused measurement fields are stored as `null`, never `0` — "no weight" must stay distinguishable from "lifted 0 kg".

#### The catalog's type model

`types/exercise.ts` is the compile-time counterpart to `validate-exercises.js`. The two are meant to say the same thing; if you change one, change the other.

- `ExerciseRecord` is the exact six-key schema (`id`, `name`, `fields`, `tags`, `videoUrl?`, `clip?`). It's exact rather than extensible because the validator rejects unknown keys outright.
- `CustomExerciseRecord` is the Firestore counterpart, with `id: \`custom:${string}\`` and `isCustom: true` as the discriminant. **Prefer `AnyExerciseRecord` in UI code** — a client's picker is always the bundled catalog *plus* their trainer's additions, so anything typed to `ExerciseRecord` alone is quietly wrong.
- `tagValues(exercise, 'muscle')` returns `Muscle[]`, not `string[]`, so a typo'd comparison against the result fails to compile.

`types/exerciseVocab.generated.ts` holds the closed vocabularies as literal unions plus template-literal tag types (`` `muscle:${Muscle}` ``), which is what makes `'muscle:quadz'` a compile error. **It is generated — do not edit it.** `scripts/exerciseVocab.js` stays the single source of truth:

```bash
npm run gen:types      # after editing scripts/exerciseVocab.js
```

Regeneration is manual and deliberately not wired into `npm run typecheck` — the check stays a single fast `tsc` call. The cost of that choice: edit `exerciseVocab.js` without running `gen:types` and the types silently lag the validator. `validate-exercises.js` still catches the data, so the failure mode is stale autocomplete rather than bad data.

#### How-to demos

Every exercise should eventually have a demo of **15–45 seconds** — long enough to show the movement, short enough that a client watches it mid-session instead of skipping. That window is defined once in `scripts/videoSources.js` as `CLIP_SECONDS` and enforced from there.

Two kinds of demo coexist in the same `videoUrl` field, on purpose. Borrowed YouTube clips give coverage now; Zeph's own footage in Firebase Storage replaces them one exercise at a time. The *kind* is derived from the URL in `utils/videoUrl.ts`, never stored, so that swap is a one-field edit with no migration and no flag to keep in sync.

`clip: { start, end }` narrows playback to the seconds that actually show the movement, which is what lets a six-minute breakdown serve as a 30-second demo — it becomes `?start=&end=` on the embed URL. It is **YouTube-only**, and the validator rejects it elsewhere: self-hosted footage is trimmed in the editor before upload, so a window there would be a second, contradictable way of saying the same thing. A `t=`/`start=` timestamp left on a watch URL is a hard error, because rewriting the link to `/embed/{id}` silently drops it — the intent has to move into `clip` or it's lost.

Self-hosting is cheap enough not to worry about: at 720p a 30s clip is ~8 MB, so all 317 is ~2.5 GB — inside Storage's free allowance, and $0.065/month if billed. Egress ($0.12/GB after 1 GB/day) is the only real cost, and these files are immutable, so **upload them with `Cache-Control: public, max-age=31536000`**. Clients rewatch the same handful of demos in their own programme constantly; with that header those replays come from the device cache, and without it you pay for every one.

Verification splits along the same offline/online line as everything else here. `validate-exercises.js` checks shape only — URL is YouTube or a playable media file, clip is whole seconds in the right window, clip has a video to clip. Whether a video still *exists*, is embeddable, is public, runs 15–45s and comes from a channel Zeph vouches for needs the YouTube Data API, so it lives in `scripts/verify-videos.js`.

#### Finding demos

`scripts/find-exercise-videos.py` searches YouTube for candidates and writes `constants/videoCandidates.json`; `scripts/promote-videos.js` copies chosen ones into the catalog. The staging file exists because **no score can tell whether a clip actually demonstrates the movement correctly** — that judgement is Zeph's and his beta testers', and the two-file split keeps an unreviewed guess from reaching a client by accident. `promote-videos.js` is `--dry` capable and refuses to overwrite an existing `videoUrl` without `--overwrite`, so a hand-picked demo is never replaced by a scored one.

It's Python, unlike the rest of `scripts/`, because yt-dlp is a Python library and driving it in-process is what keeps a 317-exercise sweep to minutes. yt-dlp is also why no API key is needed: the Data API's `search.list` costs 100 quota units a call, so one pass over the catalog would be ~31,700 against a 10,000/day ceiling — three days per sweep. The harvester rewrites its output after every completed search (via a temp file and a rename, so an interrupt can't truncate the JSON) and skips ids already present, so a run is resumable.

`--rescore` re-ranks the staging file without searching again, and `--boost SCORE` re-searches only the exercises whose best candidate falls below a score, using alternate query forms built from the muscle and modality tags — the primary query trusts the catalog's name, which fails on house shorthand (`fdrs`, `sa-sm-push-away`) and on spellings YouTube doesn't use ("Shivasana" for Savasana).

Ranking is a confidence signal, not a verdict. Name-word overlap dominates; a 15–45s duration, an instructional title, and a channel that recurs across many exercises all add. Two penalties matter more than they look: a title carrying a word that is *almost* one of ours but not it is penalised hard, because anatomical antonyms are often one letter apart and "Adduction Machine" otherwise outranks "Abduction Machine" on the shared word "machine"; and titles matching the workout-log/reaction/compilation vocabulary are pushed right down. A low top score means "search found nothing convincing", which is exactly the queue-ordering a human reviewer wants.

**What none of this can catch is a video that is live, embeddable, correctly titled and still the wrong movement** — the promoted `wall-ball` demo was wikiHow's playground game, and `db-shoulder-over` was a shoulder press. Both pass every automated check there is. `--oembed` warns when a title's words don't overlap the exercise name, which orders the review queue, but semantic correctness is irreducibly a human call. Treat the catalog's demos as reviewed only where someone has actually watched them.

"Reputable" is not something an API can judge, so it reduces to "from a channel on `APPROVED_CHANNELS`" — one human judgement, then enforced forever. That list ships **empty and unguessed**: populate it with `npm run verify:videos -- --learn`, which prints the real channel id behind every video already in the catalog. While it's empty the channel check switches itself off, so the first `--online` run reports genuine rot instead of flagging all 317 records at once. The check that matters most is the silent one: a deleted or private video simply doesn't come back in the API response, and in the app that renders as a dead player nobody reports.

Import the catalog from `constants/exerciseCatalog.ts`, not from `exercises.json` directly — a raw JSON import is inferred structurally and gives `tags: string[]`, discarding every vocabulary the facets exist to enforce.

That module's `as ExerciseRecord[]` is the one place the model is taken on trust, and it is **knowingly unverified**. TypeScript widens JSON string literals, so it cannot check the catalog's contents from a `.json` import, and `validate-exercises.js` checks the data against `exerciseVocab.js` rather than against `types/exercise.ts` — so nothing confirms those two agree. Closing that needs the catalog restated as a TS literal, which was judged not worth the machinery for the value. If a record ever renders wrongly in a way the validator passes, this assertion is the first place to look.

### Data-fetching convention

**Every Firestore read goes through `hooks/useFirestoreSnapshot.ts`** — `useFirestoreQuery` for a collection, `useFirestoreDoc` for a single document. Don't call `onSnapshot` from a hook or a screen. Each returns `{ data, loading, offline, error, retry }`, owns exactly one subscription, cleans up on unmount, and resets when its id argument is null. Collection reads sort client-side via the `sort` option, to avoid needing composite indexes (`firestore.indexes.json` is deliberately near-empty).

Domain hooks in `hooks/` stay — they wrap the helper, name the collection, and rename `data` (`useWorkouts` returns `workouts`). That's the layer to add a new read at.

Two reasons it's centralised rather than copy-pasted. First, the migration to `@react-native-firebase` should be an edit to one file, since its listener API is close enough (`onSnapshot(onNext, onError)`) to hide behind the same signature. Second, and the reason this exists at all:

**A listener left to itself can hang forever, or worse, answer confidently and wrongly.** Three different failures produce this, they need different fixes, and conflating them is why an earlier attempt fixed only one:

- **The listener errors** (rules reject it, token expires). Firestore *does* invoke the error callback, so an error callback is the fix.
- **The backend is unreachable and Firestore is still trying.** It invokes **nothing** — it queues the listener and keeps retrying, by design. Error callbacks don't help; only a timeout does.
- **Firestore gives up and answers from an empty cache.** After its own watchdog it raises a snapshot from the local cache, which without persistence is empty. `onNext` fires *successfully* with a valid "does not exist" / "no documents", **cancelling the timeout**, running no error callback, and rendering a confident empty state.

The third is the dangerous one and is easy to miss by reasoning alone — measured, it calls back at ~11 s, beating the 10 s timeout. A timeout alone would trade a visibly-stuck spinner for a page that quietly lies.

So the helper does three things per listener: an error callback; a **10 s** timeout (`SNAPSHOT_TIMEOUT_MS`, matching Firestore's own watchdog); and `snapshot.metadata.fromCache` as the offline signal, which says *this answer didn't come from the server* — still a fact about the data, not a question for the OS. That needs `includeMetadataChanges: true`, without which a reconnection confirming unchanged data raises no callback and the banner sticks.

The timeout *releases the loading gate without unsubscribing*, so late data still arrives, renders, and clears `offline` by itself — recovery is automatic and `retry` is for reassurance. Last-good data is kept on error, and a cache-backed "doesn't exist" never overwrites a profile we already have: a dropped connection must not blank out what's on screen, nor demote a trainer's session.

`offline` means specifically *this is not server-backed* — cache-sourced, timed out, or Firestore reported `unavailable`. A rules rejection sets `error` but not `offline`, because telling someone to check their wifi over a permissions bug sends them the wrong way. Surface it with `<OfflineBanner visible={offline} onRetry={retry} />`, which sits above the screen's normal content and is dismissible.

**Wrap the flag in `useOffline(...)`** (`hooks/useOffline.ts`) rather than passing a hook's `offline` straight to the banner. Nearly every read keys off `profile.uid`, so when the *profile* is what failed, the screen hands its hook a null id and the hook truthfully answers "no id, nothing to subscribe to, not offline" — every component behaves correctly and the screen still lies. `useOffline` folds in the auth-level flag.

**Do not add a connectivity library** (`expo-network`, NetInfo) to any of this. The outage that prompted the work was broken DNS on a phone that was fully "connected" — wifi associated, raw-IP HTTPS completing in ~350 ms. Anything that asks the OS about the network lies in exactly the situation being handled; watching for *data arriving* is the only check that doesn't.

`AuthContext` is the one deliberate exception: it feeds two pieces of state rather than the helper's single `{ data, loading }`, so it applies the same timeout by hand, importing the same constant so the gate and the screens under it can't disagree.

**There is no offline cache to fall back on, on native.** The JS SDK's persistence is IndexedDB-based, React Native has no IndexedDB, and the SDK *silently downgrades* to a memory-only cache that dies with the app — it warns to the console and carries on, so asking for persistence appears to work. Verified against `firebase@12.16.0`; the evidence is in `.claude/docs/offline-resilience.md`. This is why the offline UI promises "possibly incomplete" and never "showing cached data", and it's the main thing `@react-native-firebase` would buy.

### TypeScript conventions

`tsconfig.json` extends `expo/tsconfig.base` with **`strict: false`** — a deliberate choice, not an oversight. The migration from JS was mechanical: the goal is editor autocomplete and catching mistakes at module boundaries, not proving the app null-safe. Turning `strict` on would generate hundreds of errors from Firestore's `DocumentData` flowing untyped through every hook, so tightening is a per-flag decision to make later, not a prerequisite.

What that means in practice:

- **Type the boundaries, infer the insides.** Component props and exported function signatures carry annotations; locals do not.
- **Themed primitives extend React Native's own prop types** (`ViewProps`, `TextProps`, `TextInputProps`, …) rather than redeclaring `style`. Annotating them as required `style` was what produced most of the initial error count — extend, don't restate.
- **Route params use the generic**: `useLocalSearchParams<{ id: string }>()`. Without it the return is `string | string[]`, and every consumer breaks.
- **Firestore snapshot rows are `any`.** `{ id: docSnap.id, ...docSnap.data() }` loses `DocumentData`'s index signature inside an object literal, so the hooks annotate the map callback `: any`. A real `Workout`/`ProgressMedia` type would be the upgrade path here — the cast is a placeholder, and it is a lie the compiler cannot check.
- **Asset imports** (`.png`, …) are declared in `types/assets.d.ts`. That file is committed on purpose: `expo-env.d.ts` is auto-generated and gitignored, and nothing in `expo/types` declares asset modules.
- `firebase/config.ts` needs one `@ts-expect-error` for `getReactNativePersistence`, which @firebase/auth only declares in its React Native entry point while `tsc` resolves the browser one. The reason is in a comment there; don't "fix" it by deleting the import.

### UI conventions

Components are default-export function components in `components/`, styled with `StyleSheet.create` and no styling library. Themed primitives (`ThemedView`, `ThemedText`, `ThemedButton`, `ThemedCard`, `ThemedTextInput`, `ThemedLogo`) each call `useColorScheme()` and index `Colors[colorScheme] ?? Colors.light` from `constants/Colors.ts` — use them instead of raw RN primitives so light/dark keeps working. `Colors.primary` is intentionally dark enough for white button text; the brighter accent greens are icon/highlight-only.

Auth errors are mapped to human copy through `utils/firebaseErrors.ts` — route new auth failures through it rather than surfacing raw Firebase codes.

Tabs whose route is a folder (`clients`, `workouts`, `messages`, `progress`) set `headerShown: false` on their `Tabs.Screen`, because the nested `Stack` renders its own header — leaving both on shows the title twice.

**The YouTube player is split per platform, and that split is load-bearing.** `VideoEmbed.tsx` only routes; the player itself is `YouTubePlayer.tsx` (native) and `YouTubePlayer.web.tsx` (web), which Metro picks between. `VideoFrame.tsx` holds the shared 16:9 box and spinner so both render into an identically sized frame.

- **Native uses `react-native-youtube-iframe`, not our own WebView.** Getting a YouTube embed to play in a WebView is genuinely fiddly and three hand-rolled attempts failed in three different ways: pointing a WebView at the embed URL makes it a *top-level document*, which YouTube refuses (*"Error 153: Video player configuration error"*); framing it from a document whose origin claims to be youtube.com is refused differently (*"152: This video is unavailable"*). The library frames the player from a real third-party origin it hosts (`DEFAULT_BASE_URL`, a github.io page) and sets a desktop User-Agent. A clip window reaches it through `initialPlayerParams.start/end`. **Don't replace this with a bare WebView** — it looks like an unnecessary dependency and is not.
- **Web keeps a real `<iframe>` and does not use the library.** The library's web path needs `react-native-web-webview`, which is deliberately not installed; and on web the plain embed URL already works, because it genuinely sits in an iframe on the app's own origin — precisely the arrangement that is hard to reproduce on native. `YouTubePlayer.tsx` is the default (native) file so `tsc` resolves imports of `./YouTubePlayer`.
- **A web-only stylesheet clears `transform` on the fullscreen element's ancestors.** Chrome sizes a fullscreen element against its nearest ancestor carrying a CSS transform instead of the viewport, and React Native Web puts an identity `matrix(1,0,0,1,0,0)` on ScrollView. A fullscreened video therefore inherited the scroll viewport's box — measured at `1280×571 at (0,61)` against a `1280×631` viewport, offset by the header and short by its height. `*:has(:fullscreen) { transform: none }` frees it, scoped to only the ancestors involved and only while something is fullscreen.
- **Fullscreen is switched off on Android only** (`preventFullScreen`, which also disables the WebView's `allowsFullscreenVideo`). Android hands WebView fullscreen to the *Activity's* decor view while an RN `<Modal>` is a separate Dialog window above it; the two don't compose, and pressing fullscreen tore `ExerciseInfoModal` down, dropping the client back on the picker underneath. Every route to this player is inside a Modal, so no player setting fixes it. In portrait the loss is small — the frame is already full-width 16:9, and fullscreen's real gain is landscape rotation, which this app isn't set up for. Getting that back means doing fullscreen *inside* the React tree (an expanded view plus `expo-screen-orientation`) rather than handing off to Android.

Direct media files are the other branch and stay in `VideoEmbed.tsx`: `expo-video` plays them on every platform and gives native controls free. That branch is its own component rather than an inline `if`, because `useVideoPlayer` is a hook and can't be called conditionally. URL parsing lives in `utils/videoUrl.ts` so it's testable without a React Native runtime.

The native path cannot be exercised from a dev machine — web takes the `<iframe>` branch and never touches the library — so changes to `YouTubePlayer.tsx` need a device or simulator to verify.

`ExerciseInfoModal` is a stacked `Modal` rather than a pushed route on purpose — `ExercisePicker` is itself a `Modal`, and on native a pushed screen would open *behind* it. That choice is what forces the Android fullscreen compromise above; the two are linked, so revisit them together.

## Working style in this repo

History is a linear sequence of `Phase N: <feature>` commits on feature branches (`phase-N-...`) merged into `main`. Comments in this codebase explain *why* a non-obvious choice was made (rule tradeoffs, race conditions, schema tolerance) rather than restating the code — match that when adding new ones.
