# A Client may have only one active Session, enforced in the app rather than in rules

Sessions are live: one is created when a Client starts training and stays open while they work.
A Client should never have two open at once, but Firestore rules cannot run queries, so enforcing
this server-side would need either a pointer field on the user document kept consistent by a
batched write, or a fixed document path that the Session migrates out of on completion. Both add
a failure mode to every session write to prevent an outcome that is merely confusing — two open
sessions grant no access to anything — so the invariant is enforced in the UI and treated as a
product rule, not a security rule.

## Consequences

A stale open Session (the common case: a Client taps start, trains, and never taps finish) is
resolved when they next open the app — resumed or discarded — rather than by a cleanup job.
There is deliberately no `abandoned` state.
