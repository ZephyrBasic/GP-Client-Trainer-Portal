---
paths: ["constants/exercise*", "scripts/**", "types/exerciseVocab*", "components/ExercisePicker.tsx"]
---
# Exercise catalog

- Import from `constants/exerciseCatalog.ts`, never `exercises.json` directly.
- `scripts/exerciseVocab.js` owns the tag vocabularies. After editing it run `npm run gen:types`.
  Never edit `types/exerciseVocab.generated.ts`.
- Unused measurement fields are `null`, never `0`.
- After editing `exercises.json`, run `node scripts/validate-exercises.js`.
- Demos are chosen in `node scripts/review-catalog.js`, not `promote-videos.js`. Rule: ≤60s, no
  minimum (ADR 0006).
- Templates store `exerciseId`. Before deleting an id, check no live template references it.
- `npm run verify:videos` is maintenance, not a gate (needs network/API key).
