# 11: Back-dated manual Session entry

**What to build:** Clients train without their phone, so a whole Session has to be enterable afterwards. Pick the day
it counts for, fill in what was done, save. No timer runs, and duration is entered by hand.

A back-dated Session can be entered against a Template as well as free-form, so training away from
the app still earns a verdict rather than silently becoming self-directed.

**Blocked by:** 02 (Rename the workouts collection to sessions), 03 (Extract the shared exercise-and-set editor), 10 (Verdict and diff on a completed Session)

**Status:** ready-for-agent

- [ ] A Client can enter a completed Session for an earlier date
- [ ] A back-dated Session can be entered against a Template, and receives a verdict
- [ ] No timer runs; duration is entered by hand
- [ ] The Session counts for the chosen date rather than today
- [ ] Prefill from the Client's previous attempts continues to work
- [ ] Typecheck clean
