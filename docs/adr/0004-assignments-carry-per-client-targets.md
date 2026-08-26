# Assignments are records carrying per-client targets

One Workout Template can be assigned to many Clients, which invites storing the assignment as a
list of client ids on the Template itself. That was rejected: a shared template has one column of
target loads, and loads are per-person — the same plan is right for every client except the
weights. An Assignment is therefore its own record joining a Client to a Template and carrying
that Client's own targets, so two clients can run the same workout at different loads.

## Consequences

Targets live in two places — on a Template Version and on an Assignment — so publishing a new
Version resolves the collision this way: **the new Version wins for every exercise it changed**,
and a Client's overrides survive only on exercises the Version left alone. The alternative, letting
overrides always win, would mean progression silently failing to reach exactly the clients whose
loads had been customised, with nothing surfacing the failure.

Assignments are soft-removed rather than deleted, because a Client's past Sessions cite Versions of
Templates they may no longer be assigned.
