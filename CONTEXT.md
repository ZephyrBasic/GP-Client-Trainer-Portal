# GreenPulse

A workout tracker pairing personal trainers with their clients. A trainer prescribes
workouts; a client performs them and records what actually happened.

## Language

### People

**Trainer**:
A coach who authors workouts, assigns them to their clients, and reviews the sessions those
clients perform.
_Avoid_: Coach, PT, instructor

**Client**:
A person a Trainer coaches. Has exactly one Trainer at a time, set at registration and
changeable if they move to another coach.
_Avoid_: Customer, athlete, user, member

### Planning

**Workout Template**:
A named, reusable plan — an ordered list of Exercises with target sets — authored by either
a Trainer or a Client. Never a record of anything that happened.
_Avoid_: Routine, plan, workout (bare)

**Template Version**:
An immutable snapshot of a Workout Template's contents at a point in time. Progressing a
weight or swapping an exercise publishes a new Version; earlier Versions are never edited.
_Avoid_: Revision, draft, iteration

**Assignment**:
The link putting a Workout Template on a Client's list, carrying that Client's own target
loads and Target Frequency. The same Template may be assigned to many Clients, each with
different targets.
_Avoid_: Allocation, subscription, enrolment

**Target Frequency**:
How often a Trainer expects a Client to perform an assigned Workout Template — the only
expectation in a system with no schedule, and the sole basis for saying a Client is behind.
_Avoid_: Schedule, cadence, quota

**Prescribed**:
An adjective, not a thing. A Workout Template is *prescribed* when a Trainer has assigned
it to a Client. A Client's own Templates are not prescribed.
_Avoid_: Prescription (as a noun for the Template itself)

**Program**:
Deliberately **not** a concept in this system. A Trainer's program is authored and delivered
outside the app; a program update arrives here only as new or updated Workout Templates.
_Avoid_: Using "program" for any stored object, or as a synonym for Workout Template

### Performing

**Session**:
A record of one workout a Client actually performed — the sets they completed, when, and how
long it took. Started live with a running timer, or entered afterwards and back-dated.
_Avoid_: Workout (bare), log, entry, activity

**Self-Directed Session**:
A Session performed against no Workout Template at all — the Client builds it as they go.
_Avoid_: Empty workout, freestyle, ad-hoc workout

**Set**:
One performed effort within a Session, carrying only the measurements its Exercise declares.
An unused measurement is absent, never zero: "no weight" and "lifted 0 kg" are different facts.
_Avoid_: Rep, round, block

**As Prescribed / Modified**:
The verdict stored on a completed Session: *As Prescribed* only when every Set matched the
Template Version it was started from, and *Modified* on any deviation at all, however small.
A Self-Directed Session carries neither.
_Avoid_: Compliant, complete, passed, adherence

### Movements

**Exercise**:
A movement a Set can be performed against, drawn from the shared catalog. Declares which
measurements its Sets carry.
_Avoid_: Lift, movement, activity

### Measurement

**Work Volume**:
Load times repetitions for a single Exercise. It is not summed across Exercises: a weighted
carry is measured in kg-metres and a loaded hold in kg-seconds, which are different units from
kg-reps, so a combined figure cannot be compared week to week.
_Avoid_: Tonnage, total work, workload, total volume
