# GreenPulse

A workout tracker. Trainers author Workout Templates, publish immutable Versions, and assign them
to Clients. Clients perform live Sessions (prescribed or self-directed); each finished Session is
judged *As Prescribed* or *Modified*. Live at app.greenpulse.fit (Cloudflare Pages).

Expo / React Native (iOS, Android, web), TypeScript. Firebase (Auth, Firestore, Storage) is the
whole backend. There is no server of our own. Firebase project: `gp-client-trainer-portal`.

## Source of truth

- `CONTEXT.md` is the glossary. Use its words and avoid the synonyms it lists.
- `docs/adr/0001`–`0006` are settled decisions, cited by number in code comments. Read the ones
  that touch your change. If you contradict one, say so rather than overriding it quietly.
- Deliberate mismatch: the domain term is **Session**, but routes stay under `app/(tabs)/workouts/`,
  named for the tab. Renaming would give `sessions/templates/`, which is wrong.

## Commands

```bash
npm run web          # dev loop, port 8081
npm run typecheck    # gate 1
node scripts/validate-exercises.js   # gate 2
npx expo export -p web               # gate 3: compiles every route; catches bad imports
npm run build:web    # the deploy build (export + scripts/fix-web-assets.js)
```

There is no test runner and no linter. Run all three gates before calling work done. Metro doesn't
typecheck, so don't wire tsc into the dev server.

## Layout

```
app/          expo-router routes: (auth), (tabs). One tab navigator serves both roles
components/   default-export function components; Themed* primitives
hooks/        useFirestoreSnapshot + one domain hook per collection
utils/        pure helpers
constants/    Colors.ts, Motion.ts, exercises.json + exerciseCatalog.ts
scripts/      plain .js under bare node (not in tsconfig); one Python harvester
```

## Conventions

- **State:** React context + hooks. No state or styling library.
- **TypeScript:** `strict: false` is deliberate. Annotate props and exports, infer locals. Firestore
  rows are `any`. Route params use `useLocalSearchParams<{ id: string }>()`.
- **Comments:** explain *why* (tradeoffs, races, platform quirks), never restate the code.
- **Scoped rules** in `.claude/rules/` load when you touch their files: data/Firestore, UI,
  exercise catalog, web deploy.

## Scope switches

- Messaging (`app/(tabs)/messages/`) and progress media (`app/(tabs)/progress/`) are switched off
  with `href: null` in `app/(tabs)/_layout.tsx`. The code is intact; comments there say how to
  switch them back on.
- Custom exercises (`hooks/useCustomExercises.ts`, used by `ExercisePicker`) are still live but
  out of scope.

## Config

- `.env` (copy `.env.example`) holds `EXPO_PUBLIC_FIREBASE_*`. The Sentry DSN and App Check site
  key are optional and must be **inert when blank**. App Check is web-only; enforcement stays in monitor.
- `YOUTUBE_API_KEY` is intentionally not `EXPO_PUBLIC_`, so it is never bundled.
- Trainer signup is gated by Firestore `config/trainerSignup.code`. If it is missing, nobody can
  register as a trainer (fail-closed by design).

## Live project: Zephyr runs these, not you

`firebase deploy`, `scripts/seed-test-data.js`, `scripts/smoke-test-rules.js` (expect 70 passed),
migrations, and anything using `secrets/service-account.json`. Give the exact command and what to
expect. Non-interactive ones can go through `!`; interactive scripts need a real terminal.

## Workflow

- Git: `phase-N-<slug>` branches merge to `main` as `Phase N: <feature>`. Commits inside a branch
  are plain-English sentences, with no `feat:`/`fix:` prefixes.
- **Pushing `main` deploys production.** The Cloudflare Pages GitHub app builds every push to
  `main` (`npm run build:web`). No manual step. cPanel (VentraIP) hosts only the apex greenpulse.fit.
- Browser testing: phones use `http://<laptop LAN IP>:8081` (`ipconfig`), never localhost.
  Claude-in-Chrome tabs are hidden, so rAF/timers stall: verify motion by screenshot, swipe via TouchEvents.
- Tickets live in `.claude/tickets/new/` (gitignored) and move to `done/` when shipped. No plan
  files or spec docs; put the full spec in the subagent brief.
- Run subagents **one at a time**: they share one working tree and parallel ones collide.
- Tracked docs live in `docs/`. `.claude/` is disposable tool state, mostly gitignored.
- Context budget (reset 2026-09-25): this file ≤100 lines; it plus `.claude/rules/`, memory and
  `~/.claude/CLAUDE.md` ≤200. Add a line only when learned and earning its keep; delete stale ones.
  No process plugins or skills (cook, mattpocock and Superpowers were removed).
