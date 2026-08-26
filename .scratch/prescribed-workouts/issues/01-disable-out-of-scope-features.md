# 01: Disable messaging, progress media and custom Exercises

**What to build:** Narrow the app to the core tracking loop. Messaging and progress media disappear from the tab bar
for both roles, and the exercise picker offers only the shared catalog with no way to add a movement
of your own. Nothing is deleted: the screens, hooks and authorization rules for all three stay in
place, so any of them can be switched back on later by restoring a single tab entry.

The cost of the custom-Exercise half is deliberate and already decided — prescribing a movement the
catalog doesn't carry now means adding it to the catalog and shipping a build.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Neither Messaging nor Progress appears in the tab bar, for a Trainer or a Client
- [ ] The Trainer's route into a Client's progress media is gone
- [ ] The exercise picker lists catalog Exercises only, and offers no way to create one
- [ ] Authorization rules for messaging, progress media and custom Exercises are left untouched
- [ ] Typecheck and the exercise-catalog validator stay clean
