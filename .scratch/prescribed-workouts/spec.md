# Spec: Prescribed workouts and live sessions

Status: ready-for-agent

Vocabulary is `CONTEXT.md`. Decisions already settled live in `docs/adr/0001`–`0005` and are not
re-argued here; this spec covers what those leave open.

## Problem Statement

A Trainer writes detailed programming for their Clients and delivers it outside the app. The app
knows nothing about it. A Client opens GreenPulse, finds an empty form, and has to retype from
memory or from a document on another screen the workout they were given — every exercise, every
target, every session. Nothing in the app knows what was asked of them.

The consequences run both ways. The Client gets no prefilled targets, no way to save a workout they
repeat weekly, and has to fill the whole form after training rather than working through it. The
Trainer, reviewing a Client's history, sees a list of logged workouts with no way to tell whether
any of them was the workout they prescribed, whether the Client hit the loads, or whether they
trained as often as agreed. The coaching loop — prescribe, perform, review — is broken at both ends,
and the app currently only serves the middle.

## Solution

A Trainer authors a **Workout Template**: a named, reusable plan of Exercises with target Sets. They
**assign** it to one or more Clients, giving each their own target loads and a **Target Frequency**.
Editing a Template publishes a new **Template Version**; earlier Versions are never altered, so past
work stays truthful.

A Client opens their workouts and sees what they have been prescribed alongside any Templates they
saved themselves. They start one, a timer runs, and they check off Sets as they perform them, with
targets already filled in. They can adjust freely — change a load, add a Set, add or drop an
Exercise — and the **Session** is still recorded as that workout. If they trained without their
phone they enter the Session afterwards and back-date it. If they want to train off-plan they start
a **Self-Directed Session** with nothing in it.

On completion the Session stores a verdict: **As Prescribed** if every Set matched the Version it
ran, **Modified** on any deviation. The Trainer sees that verdict against each Session, an itemised
diff of what changed, and how many Sessions were completed this week against what was expected.

## User Stories

### Trainer

1. As a Trainer, I want to author a Workout Template, so that I can reuse a workout instead of
   rewriting it for every Client.
2. As a Trainer, I want to add Exercises to a Template from the catalog, so that a Client sees the
   same movement names I use.
3. As a Trainer, I want to set target Sets on each Exercise, so that the Client knows how many to do.
4. As a Trainer, I want to set target loads, reps, durations or distances per Set, so that my intent
   is unambiguous rather than implied.
5. As a Trainer, I want to leave a measurement blank where it doesn't apply, so that a bodyweight
   movement isn't prescribed as zero kilos.
6. As a Trainer, I want editing a Template to publish a new Template Version, so that Sessions
   performed against earlier Versions keep their meaning.
7. As a Trainer, I want to see which Version is current, so that I know what my Clients are looking
   at right now.
8. As a Trainer, I want to assign one Template to several Clients, so that a workout I wrote once
   serves everyone it suits.
9. As a Trainer, I want to set per-Client target loads on an Assignment, so that the same workout
   works for a beginner and an advanced lifter.
10. As a Trainer, I want to set a Target Frequency per Assignment, so that expectations are explicit
    without maintaining a calendar in the app.
11. As a Trainer, I want to adjust one Client's loads without publishing a new Version, so that
    tweaking one person doesn't disturb everyone else.
12. As a Trainer, I want progressing a Template to reach every assigned Client, so that a weekly
    progression is one edit rather than one per Client.
13. As a Trainer, I want my progression to take precedence over a Client's older per-Client load on
    the Exercises I changed, so that an update actually lands on the Clients I've customised.
14. As a Trainer, I want a Client's per-Client loads to survive on Exercises I didn't change, so
    that unrelated customisation isn't silently wiped by an unrelated edit.
15. As a Trainer, I want to unassign a Template, so that it leaves a Client's list when a training
    block ends.
16. As a Trainer, I want an unassigned Template's history to stay readable, so that the Client's
    past Sessions don't become unexplainable.
17. As a Trainer, I want to see each Client's Sessions labelled with the workout they ran, so that
    I can tell prescribed work from self-directed work at a glance.
18. As a Trainer, I want each Session marked As Prescribed or Modified, so that I know which ones
    are worth opening.
19. As a Trainer, I want an itemised diff of a Modified Session, so that I know exactly what changed
    rather than only that something did.
20. As a Trainer, I want to see Sessions completed this week against what was expected, so that I
    can tell whether a Client is keeping up.
21. As a Trainer, I want no ratio shown for a Client with no Assignments, so that I'm not given a
    meaningless number.
22. As a Trainer, I want to review a Client's Sessions without being able to alter them, so that
    the record stays the Client's own.
23. As a Trainer, I want to author Templates from my own tab in the app, so that prescribing doesn't
    require going through a Client's profile.

### Client

24. As a Client, I want to see the workouts my Trainer has assigned me, so that I know what I'm
    supposed to do.
25. As a Client, I want to see my Trainer's workouts and my own saved Templates in one list, so
    that everything I train is in one place.
26. As a Client, I want to create my own Workout Template, so that I can save a routine my Trainer
    didn't prescribe.
27. As a Client, I want to start an assigned workout, so that I can train directly from the plan.
28. As a Client, I want my targets prefilled when I start, so that I don't have to remember what I'm
    aiming for.
29. As a Client, I want to see my own targets rather than another Client's, so that the numbers are
    actually mine.
30. As a Client, I want a timer to start when I start a Session, so that my training duration is
    captured without me having to time it.
31. As a Client, I want to check off Sets as I complete them, so that I don't lose my place mid-workout.
32. As a Client, I want to change a weight or rep count as I go, so that a strong day or a bad day is
    recorded truthfully rather than aspirationally.
33. As a Client, I want to add a Set beyond what was prescribed, so that extra work is captured.
34. As a Client, I want to add an Exercise mid-Session, so that anything I did is recorded.
35. As a Client, I want to skip an Exercise, so that I'm not forced to log work I didn't do.
36. As a Client, I want my Session still recorded as that workout even after I adjust it, so that my
    history stays organised by what I set out to do.
37. As a Client, I want my duration defaulted from the timer but editable, so that a phone left
    running through lunch doesn't ruin the record.
38. As a Client, I want to start an empty Self-Directed Session, so that I can train without a plan.
39. As a Client, I want to be prevented from starting a second Session while one is open, so that my
    record doesn't fragment across two half-finished entries.
40. As a Client, I want to be offered a Session I left open to resume or discard, so that forgetting
    to press finish doesn't block me from training tomorrow.
41. As a Client, I want to enter a Session afterwards and back-date it, so that training without my
    phone still counts.
42. As a Client, I want a back-dated Session to be enterable against a Template, so that it still
    gets a verdict.
43. As a Client, I want my Session history newest first, so that recent training is what I see.
44. As a Client, I want each past Session to show its verdict, so that I can see how closely I've
    been following the plan.
45. As a Client, I want the diff on a Modified Session, so that I remember what I actually changed.
46. As a Client, I want a past Session's verdict never to change when my Trainer updates the workout,
    so that my history stays honest.
47. As a Client, I want to see Work Volume per Exercise, so that I can see whether a specific lift is
    progressing.
48. As a Client, I want my workouts and history to load without signal, so that a gym basement
    doesn't stop me training.
49. As a Client, I want to be told when I'm offline and be able to retry, so that I know whether what
    I'm seeing is current.
50. As a Client, I want measurements I didn't use left blank rather than zeroed, so that "no weight"
    stays distinguishable from "lifted nothing".

## Implementation Decisions

### The seam

All domain logic for this feature sits behind **one pure module, `prescription`, in `utils/`**. It
takes and returns plain data — no React, no Firestore, no React Native runtime — matching the
existing purity of the stats and exercise-history helpers. Two exported operations:

- **Resolve targets** — given a Template Version, the Version preceding it, and an Assignment,
  return the targets a specific Client should see.
- **Compare a Session** — given a performed Session and the targets it ran against, return the
  verdict and an itemised diff.

Screens and hooks import only this module. No other seam is introduced; everything else is thin
glue over it and over the existing Firestore snapshot helper.

### Workout Templates and Versions

A Template document holds identity — name, author, and a pointer to the current Version. Versions
live beneath it and are **immutable**: never updated, never deleted. Identity stays stable across a
year of progressions, so a Template is one thing over its whole life.

A Template is one object regardless of who wrote it; a Client-authored Template is the same shape
with the Client as author. Only the author may edit. Version target Sets use the same nullable
measurement shape as performed Sets, so an unused dimension is absent rather than zero.

### Assignments

An Assignment joins a Client to a Template and carries that Client's target loads, a Target
Frequency, and an active flag.

**Its identifier is derived from the Template and Client identifiers together.** Firestore rules
cannot run queries, so a Client's permission to read a Template must be checkable by constructing a
path and testing existence. This follows the pattern the chat collection already uses, and avoids a
participants array.

**Per-Client overrides record the Version they were set against.** Resolution happens at read time,
inside the seam module, not when a Version is published: publishing would otherwise have to fan a
write out to every Assignment, and there is no server to do it. The resolver ignores an override
whose Exercise differs between the Version it was based on and the current one — which is exactly
ADR 0004's rule, computed rather than materialised, and correct offline.

**Unassigning sets the flag false and never deletes.** The surviving document is what keeps the
existence check true, which is what keeps a Client's past Sessions readable after unassignment.

### Sessions

A Session gains a status of active or completed, a start timestamp and a completion timestamp,
alongside the existing performed Exercises, notes, duration and the date it counts for.

- The date it counts for stays user-editable, so back-dating works unchanged.
- Duration is defaulted from the timer at completion and stays editable; a back-dated Session has no
  timer at all.
- Check-off is local state with a **single write at completion**, not a write per Set. Per-Set writes
  would multiply writes by roughly twenty per workout and break the immutability that makes a Session
  trustworthy history.
- A Session performed against a Template stores the Template identifier, **the Version identifier**,
  the Template name, and the verdict. Storing the Template alone would reintroduce the ambiguity
  versioning exists to remove.
- The Template name is denormalised so a history list renders without resolving Versions — this
  matters on a phone with poor signal.
- The verdict is written **once at completion and never recomputed**, so it survives even if Version
  resolution later fails.
- A Self-Directed Session omits all four fields — absent, not empty.
- Only one active Session per Client, enforced in the UI. A stale active Session is offered as
  resume-or-discard when the workout list opens; there is deliberately no abandoned state and no
  cleanup job.

### Collection naming

The collection currently called `workouts` is renamed to `sessions` to match the glossary. This is a
data migration, performed by a one-off Node script using the Admin SDK against a service account,
idempotent and dry-run capable, per the repo's migration convention. The domain hook and the client
routes are renamed with it.

### Authorization

Rules are extended in the same change as the collections, per the repo convention, with their
reasoning in comments.

- A Template is readable by its author, or by a Client whose Assignment path exists.
- Versions follow the parent for reads and are create-only — no update, no delete.
- An Assignment is readable by its named Client and by the owning Trainer; only the Trainer who owns
  the Template may write it, with the derived identifier verified against the payload. Client and
  Template are fixed at creation.
- Sessions carry the existing rules unchanged: the owning Client has full control, the linked Trainer
  is read-only.

### Scope reductions

Messaging and progress media are disabled at the tab level; custom Exercises are dropped as a source
in the exercise picker. Code and rules for all three are left intact so re-enabling is a one-line
change. Templates therefore draw only from the shared catalog.

The Trainer's workouts tab, currently hidden by role, is enabled — Trainers presently have nowhere
to author anything.

## Testing Decisions

**This repo has no test runner and no linter, and that stays true for this feature.** The automated
gates remain typechecking and the exercise-catalog validator, both of which must stay clean. There
is no prior art for tests in this codebase because there are none; the closest analogue is the
catalog validator, a plain Node script that exits non-zero.

Given that, quality rests on the seam and on deliberate manual verification.

**What the seam buys.** The `prescription` module is pure and takes plain data, so its behaviour can
be reasoned about — and later tested, if a runner is ever added — without mounting a component,
authenticating, or reaching Firestore. That is the whole reason for putting target resolution and
session comparison behind one boundary rather than inlining either into a screen. A test of it would
assert external behaviour only: given a Version, a preceding Version, an Assignment and a Session,
what targets and what verdict come out. It would not reach for intermediate structures.

**Cases that must be verified by hand at the seam**, because they are the ones prose most easily gets
wrong:

- An override survives a progression that changed a different Exercise.
- An override is discarded when its own Exercise is the one progressed.
- With no override, the Version's targets are what the Client sees.
- An exact match yields As Prescribed; one rep short yields Modified.
- An added Exercise, a dropped Exercise and a changed Set count each yield Modified with the change
  itemised.
- A workout of planks and carries — zero loaded volume by design — still compares correctly, since
  the verdict is a Set-by-Set comparison and never a volume subtraction.
- Absent measurements stay absent through resolution and comparison, and never become zero.

**Authorization is verified manually**, by signing in as a Trainer and as both an assigned and an
unassigned Client, and confirming that a Client cannot read a Template they neither own nor are
assigned, that an unassigned Client can still read the Versions their past Sessions cite, and that a
Trainer cannot write another Trainer's Templates. The Firestore emulator and rules unit testing were
considered and deliberately not adopted; if the rules grow past this feature, revisit that.

**The live Session flow is verified by running the app** — the timer, check-off, resume-or-discard,
and the single-active-Session guard have no automated coverage and cannot get any without a runner
and a React Native test environment. Verify on web for the main loop, and on a device for anything
touching backgrounding, since elapsed time must be derived from the start timestamp rather than
counted in ticks.

## Out of Scope

- **Messaging, progress media and custom Exercises** — disabled, not removed.
- **Any Program or scheduling structure.** There is no calendar, no due date and no missed-workout
  state; Target Frequency is the only expectation the model carries.
- **Push notifications** on Session completion.
- **A Trainer watching a Session in flight.** Sessions are live documents but nothing streams them.
- **Changing a Client's Trainer.** The glossary says it is possible; the rules currently forbid it,
  deliberately, because the same clause prevents a Client promoting themselves to Trainer. That needs
  its own gated path and is separate work.
- **Reconciling Work Volume totals.** Per-session and all-time volume totals remain on screen as
  shipped even though the glossary defines Work Volume per-Exercise. Deliberate; see Further Notes.
- **Automated tests of any kind**, including rules unit tests.

## Further Notes

Three divergences between the glossary and the code are known and deliberate; none should be
"fixed" as a side effect of this work.

1. **Work Volume** is defined per-Exercise and never summed across Exercises, but per-session and
   all-time volume totals are computed and displayed today. Those predate the term and stay as
   shipped. New work — including anything this spec adds — measures volume per Exercise.
2. **Session** is the domain term, but the collection, hook and routes are named for workouts until
   the migration above lands.
3. **A Client's Trainer** is changeable in the glossary and immutable in the rules. Out of scope
   here, but do not delete the rule clause in passing: it also guards role.

Two consequences worth holding in mind while building. First, the verdict is the only thing a
Trainer sees at a glance, and under ADR 0005 most Sessions will be Modified — the verdict answers
"is this worth opening?", not "was this good". If it proves noisy, the fix is a richer diff, not a
looser rule, because verdicts are written once and older ones would keep the stricter semantics.
Second, the resolve-at-read-time design means a Client's effective targets are computed on device
from two Versions and an Assignment; keep that computation inside the seam module rather than
letting screens reach for Version data directly, or the rule in ADR 0004 will end up implemented
twice and drift.
