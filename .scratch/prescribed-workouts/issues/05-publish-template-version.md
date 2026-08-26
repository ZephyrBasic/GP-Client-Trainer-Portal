# 05: Editing a Template publishes a new Version

**What to build:** A Trainer progresses a workout — squats go from 60kg to 65kg — and that lands as a **new Template
Version** rather than an edit to the existing one. Earlier Versions stay exactly as they were,
because Sessions performed against them depend on it.

Make this visible in the interface. The Trainer is progressing a workout, not correcting a typo,
and the distinction is what keeps their Clients' history honest.

**Blocked by:** 04 (A Trainer can author a Workout Template)

**Status:** ready-for-agent

- [ ] Editing a Template publishes a new Template Version rather than altering the current one
- [ ] Earlier Versions remain readable and cannot be updated or deleted through any path
- [ ] The Template records and displays which Version is current
- [ ] The interface makes clear that saving publishes a new Version
- [ ] Typecheck clean
