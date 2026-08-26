# Any deviation makes a Session Modified

A Session is judged against the Template Version it was started from and stored as either
*As Prescribed* or *Modified*. That verdict is strict: one rep short or one kilo over is Modified,
with no tolerance band. A band would have to be some percentage neither the trainer nor the code
can justify, and the looser alternative — flagging only structural changes like added or dropped
exercises — would let a client lift 40 kg where 80 kg was prescribed and call it compliant, which
is the deviation a coach most needs to see.

## Consequences

Most Sessions will be Modified, so the verdict answers "is this worth opening?" rather than "was
this good". If that proves too noisy the fix is a richer diff view, not a fuzzier verdict: the
verdict is written once at completion and never recomputed (see ADR 0002), so relaxing the rule
later would leave older Sessions judged by the older, stricter one.
