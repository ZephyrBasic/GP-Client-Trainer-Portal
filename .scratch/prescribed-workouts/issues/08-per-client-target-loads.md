# 08: Per-Client target loads

**What to build:** The reason an Assignment is a record rather than a list of names: the same workout is right for
every Client except the weights. A Trainer sets target loads for one Client without touching what
anyone else sees, and each Client starting the workout sees their own numbers prefilled.

Demoable: assign one Template to two Clients at different loads, start it as each, and see two
different sets of targets.

This is the first half of the single `prescription` module. Resolving what a given Client should see
belongs there and nowhere else — if a screen works it out for itself, the rule ends up implemented
twice and drifts.

**Blocked by:** 06 (A Trainer assigns a Template, and the Client sees it), 07 (A Client performs a live Session)

**Status:** ready-for-agent

- [ ] A Trainer can set target loads for one Client without changing what other Clients see
- [ ] A Client starting a workout sees their own targets prefilled
- [ ] Two Clients assigned the same Template at different loads each see only their own
- [ ] Target resolution lives behind the single prescription module; no screen computes it
- [ ] Measurements that are absent stay absent through resolution rather than becoming zero
- [ ] Typecheck clean
