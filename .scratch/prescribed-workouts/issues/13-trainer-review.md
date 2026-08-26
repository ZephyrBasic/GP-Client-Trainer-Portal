# 13: Trainer review: verdicts, diffs and weekly completion

**What to build:** What the Trainer came for. Reviewing a Client, each Session shows which workout it ran and whether
it was As Prescribed or Modified, opening to the itemised diff. Above it, how many Sessions were
completed this week against how many were expected, summed from that Client's active Assignments.

A Client with no Assignments has no denominator — there is no schedule in this system — so show
counts without a ratio rather than inventing one.

Sessions stay the Client's own: the Trainer reads, never writes.

**Blocked by:** 06 (A Trainer assigns a Template, and the Client sees it), 10 (Verdict and diff on a completed Session)

**Status:** ready-for-agent

- [ ] Each Session on a Client's detail view shows the workout it ran and its verdict
- [ ] A Trainer can open the itemised diff for a Modified Session
- [ ] Sessions completed this week are shown against the total expected across active Assignments
- [ ] A Client with no active Assignments shows counts without a ratio
- [ ] A Trainer cannot alter a Client's Sessions through any path
- [ ] Existing summary statistics on that view are left as they are
- [ ] Typecheck clean
