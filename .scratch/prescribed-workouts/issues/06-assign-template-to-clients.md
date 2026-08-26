# 06: A Trainer assigns a Template, and the Client sees it

**What to build:** The first slice that crosses both roles. A Trainer picks one or more Clients for a Template and
sets a **Target Frequency** for each — how often that Client is expected to perform it. The Client
opens their workouts and the prescribed one is there.

Target Frequency is the only expectation the model carries; there is no calendar, no due date and
no missed-workout state, so a Client picks their own day and can repeat a workout as often as they
like. Per-Client target loads come in a later ticket, so every assigned Client sees the same
numbers for now.

**Blocked by:** 04 (A Trainer can author a Workout Template)

**Status:** ready-for-agent

- [ ] A Trainer can assign one Template to several Clients
- [ ] A Trainer sets a Target Frequency for each assigned Client
- [ ] An assigned Client sees the Template in their workout list
- [ ] A Client can read a Template only by authoring it or via an existing Assignment
- [ ] A Client cannot create, alter or delete an Assignment
- [ ] A Trainer cannot assign a Template they do not own, or assign to someone else's Client
- [ ] Typecheck clean
