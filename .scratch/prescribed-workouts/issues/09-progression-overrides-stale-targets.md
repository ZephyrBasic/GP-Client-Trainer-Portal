# 09: Progression wins over stale per-Client loads

**What to build:** The subtlest rule in the feature, and the behaviour of the thing a Trainer does most often.

A Client has their own target of 60kg on squats. The Trainer publishes a new Version taking squats
to 65kg. The new Version wins — for squats. The Client's own targets on every Exercise the Version
left alone survive untouched.

The alternative, letting a Client's older target always win, means a progression silently fails to
reach exactly the Clients whose loads had been customised, with nothing surfacing the failure.

Resolve this when targets are read, not by rewriting Assignments when a Version is published: there
is no server to fan those writes out, and read-time resolution stays correct offline.

**Blocked by:** 05 (Editing a Template publishes a new Version), 08 (Per-Client target loads)

**Status:** ready-for-agent

- [ ] Publishing a Version that changes an Exercise replaces a Client's older target for that Exercise
- [ ] A Client's own targets survive on Exercises the new Version did not change
- [ ] With no per-Client target set, the Version's own targets are what the Client sees
- [ ] The rule is computed when targets are read, not by rewriting Assignments on publish
- [ ] The rule lives in the prescription module only
- [ ] Typecheck clean
