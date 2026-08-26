# 07: A Client performs a live Session

**What to build:** The screen the whole feature exists for. A Client starts an assigned workout — or an empty
**Self-Directed Session** if they are training off-plan — a timer runs, and they check off Sets as
they perform them with the targets already filled in.

They can adjust freely: change a load, add a Set, add an Exercise, skip one. The Session is still
recorded as that workout; the deviation is recorded rather than blocked. Completion writes the whole
Session once, at the end, rather than a write per Set.

Only one Session may be open at a time. The common failure is a Client who taps start, trains, and
never taps finish, so a Session left open is offered back to them as resume-or-discard.

**Blocked by:** 02 (Rename the workouts collection to sessions), 03 (Extract the shared exercise-and-set editor), 06 (A Trainer assigns a Template, and the Client sees it)

**Status:** ready-for-agent

- [ ] A Client can start an assigned workout, or start an empty Self-Directed Session
- [ ] Starting begins a visible timer and opens the Session as active
- [ ] Sets can be checked off as they are performed, with targets prefilled
- [ ] Weight, reps and Set count can be changed, and Exercises added or skipped, mid-Session
- [ ] A Session started from a Template is still recorded as that workout after adjustment
- [ ] Completing writes the Session once, storing a duration defaulted from the timer and editable
- [ ] Elapsed time is derived from the start timestamp, so backgrounding the app does not lose it
- [ ] Starting is unavailable while another Session is open
- [ ] A Session left open is offered as resume-or-discard when the workout list is opened
- [ ] Measurements not used are stored as absent, never zero
- [ ] Typecheck clean
