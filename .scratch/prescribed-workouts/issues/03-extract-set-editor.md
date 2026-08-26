# 03: Extract the shared exercise-and-set editor

**What to build:** The block that renders an Exercise with its editable Sets — the measurement columns that Exercise
declares, a numeric input per Set, add and remove a Set, remove the Exercise, and the hint showing
what was done last time — currently lives inline in the manual entry screen. Three screens need it:
manual entry, authoring a Template's target Sets, and performing a live Session.

Pure prefactor. No behaviour changes anywhere; this exists so the tickets after it are small.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Manual entry behaves exactly as it does today, with no visible difference
- [ ] The extracted component renders the measurement columns an Exercise declares, editable Sets, and add/remove Set and remove Exercise controls
- [ ] It is driven by data passed in rather than reaching for a Session or a Template itself, so it can serve target Sets and performed Sets alike
- [ ] Measurements left blank stay absent rather than becoming zero
- [ ] Typecheck clean
