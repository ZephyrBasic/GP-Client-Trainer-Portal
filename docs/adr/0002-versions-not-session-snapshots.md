# Session history rests on Template Versions, not per-session snapshots

A completed Session must stay truthful about what was asked of it, even after the Trainer
progresses the workout — otherwise editing a template silently rewrites what past sessions
appear to have been. The usual fix is to freeze a copy of the plan onto every Session; instead,
Workout Templates are versioned immutably and a Session references the exact Template Version it
ran. The historical copy exists either way, but there are far more Sessions than Versions, so
storing it once per Version rather than once per Session is the cheaper place to keep it.

## Consequences

A Session records a Template *Version*, never a bare Template — referencing the template alone
would reintroduce the ambiguity versioning exists to remove. The As Prescribed / Modified verdict
is stored on the Session at completion rather than recomputed on read, so the verdict survives
even when Version resolution fails. Because history depends on Versions staying readable,
unassigning a Template must not revoke a Client's access to the Versions their Sessions cite.
