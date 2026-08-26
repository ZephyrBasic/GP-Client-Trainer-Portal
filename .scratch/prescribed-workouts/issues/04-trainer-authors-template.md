# 04: A Trainer can author a Workout Template

**What to build:** Trainers have nowhere to author anything today — their Workouts tab is hidden by role. Give them
one, and let them build a **Workout Template**: a named, reusable plan of catalog Exercises with
target Sets.

Demoable on its own: a Trainer creates "Upper Body A", sets three Exercises with target Sets, and
sees it listed. Nobody else can see it yet — assigning comes later.

**Blocked by:** 03 (Extract the shared exercise-and-set editor)

**Status:** ready-for-agent

- [ ] A Trainer has a Workouts tab listing the Templates they authored
- [ ] They can create a named Template, add Exercises from the catalog, and set target Sets on each
- [ ] A target measurement left blank is stored as absent, not as zero
- [ ] Creating a Template records its first Template Version
- [ ] A Client cannot read a Template they neither authored nor are assigned
- [ ] A Trainer cannot alter another Trainer's Template
- [ ] Typecheck clean
