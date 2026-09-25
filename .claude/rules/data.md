---
paths: ["hooks/**", "contexts/**", "firebase/**", "firestore.rules", "storage.rules", "scripts/*migrat*"]
---
# Data and Firestore

- Every read goes through `hooks/useFirestoreSnapshot.ts` (`useFirestoreQuery` / `useFirestoreDoc`).
  Never call `onSnapshot` directly (`AuthContext` is the one exception).
- New reads get a domain hook in `hooks/` that renames `data` (`useSessions` returns `sessions`).
- Sort client-side with the `sort` option, not `orderBy`; `firestore.indexes.json` stays empty.
- Offline comes from snapshot metadata, never a connectivity library. Show it with
  `<OfflineBanner>` wrapped in `useOffline(...)`.
- `firestore.rules` / `storage.rules` are the real auth layer. Anything unmatched is denied. New
  collection means new rules in the same change. Deploying them is Zephyr's job.
- Migrations: one-off idempotent Admin SDK scripts in `scripts/` with `--dry`.
- `firebase/config.ts` needs its one `@ts-expect-error` (getReactNativePersistence). Leave it.
