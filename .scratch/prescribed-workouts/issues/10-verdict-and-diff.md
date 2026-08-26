# 10: Verdict and diff on a completed Session

**What to build:** Second half of the `prescription` module, and the thing that closes the coaching loop. When a
Session completes it is judged against the Template Version it ran and stored as **As Prescribed**
or **Modified**, alongside an itemised account of what changed.

The verdict is strict: one rep short or one kilo over is Modified. Most Sessions will be Modified,
and that is intended — the verdict answers "is this worth opening?", not "was this good". The diff
answers what actually happened.

Compare Set by Set. There is no single combined work-volume figure to subtract, by design, so a
workout of planks and carries must compare correctly rather than reading as zero against zero.

**Blocked by:** 07 (A Client performs a live Session), 08 (Per-Client target loads)

**Status:** ready-for-agent

- [ ] A completed Session performed against a Template stores either As Prescribed or Modified
- [ ] An exact match yields As Prescribed; any deviation, including a single rep, yields Modified
- [ ] An added Exercise, a skipped Exercise and a changed Set count each yield Modified
- [ ] The Session records which Template Version it ran, and the Template's name
- [ ] The verdict is written once at completion and never recomputed
- [ ] A past Session's verdict is unaffected by Versions published afterwards
- [ ] A Self-Directed Session carries no verdict at all, rather than a neutral one
- [ ] A Client sees the verdict in their history and can open an itemised diff
- [ ] Comparison is Set by Set, never a subtraction of combined volume
- [ ] Typecheck clean
