# 02: Rename the workouts collection to sessions

**What to build:** The stored record of a workout a Client performed is a **Session** everywhere in the domain and a
workout everywhere in the code. Align them before anything new is built on top, so the mismatch
never reaches the new work.

Nothing changes for anyone using the app: a Client's history looks exactly as it did before, and
the Trainer's view of it is unchanged. This is a data migration rather than a rename, so the
script that moves existing records is the risky part, not the call sites.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A migration script moves every existing record, is safe to re-run, and supports a dry run that reports what it would do without writing anything
- [ ] Record counts are verified before anything is deleted
- [ ] The domain hook and the Client-facing routes use the Session name
- [ ] Authorization for the renamed collection is unchanged: the owning Client keeps full control, the linked Trainer stays read-only
- [ ] No reference to the old collection name remains outside the migration script
- [ ] Typecheck clean, and a Client's history renders identically before and after
