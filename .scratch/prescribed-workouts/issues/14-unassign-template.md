# 14: Unassigning a Template leaves history intact

**What to build:** A training block ends and a workout should leave the Client's list — without taking their history
with it. Unassigning stops a Client starting the workout and removes it from their list, while every
Session they already performed against it keeps its name, its verdict and its diff.

That means unassigning marks the Assignment inactive rather than deleting it: the record surviving
is what keeps the Client's access to the Versions their past Sessions cite.

**Blocked by:** 06 (A Trainer assigns a Template, and the Client sees it), 10 (Verdict and diff on a completed Session)

**Status:** ready-for-agent

- [ ] A Trainer can unassign a Template, and it leaves that Client's workout list
- [ ] Unassigning does not delete the Assignment record
- [ ] The Client's past Sessions against it still show the workout name, verdict and diff
- [ ] An unassigned Client can still read the Template Versions their Sessions cite
- [ ] An unassigned Client can no longer start the workout
- [ ] Re-assigning restores it to the list without duplicating anything
- [ ] Typecheck clean
