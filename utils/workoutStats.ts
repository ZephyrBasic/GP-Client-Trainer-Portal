const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The Sessions that count as "this week".
 *
 * The trailing seven days, deliberately, and not the calendar week. Target
 * Frequency is an expectation rather than a schedule (ADR 0001): there are no
 * due dates and nothing is ever overdue, so a boundary that resets to zero every
 * Monday morning would show every Client as having done nothing for the first
 * day and a half of it - which is not a fact about their training. A trailing
 * window answers the question a Trainer is actually asking, "are they doing it?",
 * and never lies at the start of a week.
 *
 * Exported so the Client's own Today screen, the Trainer's review of that same
 * Client, and the completion ratio between them all mean the same thing by "this
 * week". Two windows on one screen, both labelled the same way, would be a bug
 * nobody could see.
 *
 * This is all that is left of a module that also totalled Work Volume, loaded
 * distance, loaded time and reps across a Session. Those totals fed one summary
 * card and one figure on the Trainer's review screen, and the Signal redesign
 * (phase 12) removed both: Today and History draw no cross-session summary at
 * all. The arithmetic went with them rather than being left compiling and
 * unread - it also summed Work Volume *across* Exercises, which CONTEXT.md is
 * explicit that the term does not mean, so nothing should grow back from it
 * without reading that entry first. `git log` has it if a summary screen ever
 * returns.
 */
export const sessionsThisWeek = (workouts, now = Date.now()) =>
    workouts.filter((w) => w.date?.toMillis && now - w.date.toMillis() <= ONE_WEEK_MS)
