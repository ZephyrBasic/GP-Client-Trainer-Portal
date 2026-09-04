import { sessionsThisWeek } from './workoutStats'

/**
 * How much of what a Trainer expects has actually happened this week.
 *
 * `expected` is **null** when there is nothing to expect, and that is the whole
 * decision this module exists to hold. A Client with no active Assignments has
 * no denominator - there is no schedule in this system (ADR 0001), so the only
 * source of "how many" is the Target Frequencies on their Assignments, and
 * summing an empty list gives 0. Reporting "3 of 0" would be arithmetic
 * masquerading as an expectation, and reporting "3 of 3" would invent one. Null
 * says there is no ratio to draw, and the card says so in words instead.
 *
 * Zero is therefore a different answer from null, and stays reachable: a Client
 * whose only Assignment is at one a week is 0 of 1 on Monday, which is a real
 * fact about a real expectation.
 */
export type WeeklyCompletion = {
    /** Sessions performed in the trailing seven days - see sessionsThisWeek. */
    completed: number
    /** Summed Target Frequency across active Assignments, or null when there are none. */
    expected: number | null
}

/**
 * Counted across *all* their Sessions, not only the prescribed ones.
 *
 * A Client who did their assigned workout twice and a run of their own has
 * trained three times, and a Trainer glancing at a completion figure is asking
 * how much work happened. Filtering to Sessions that cite a Template would also
 * make the numerator and the denominator answer different questions - the
 * frequency was never per-Template in the Trainer's head, it was "three times a
 * week".
 *
 * The denominator sums the whole roster of active Assignments for the same
 * reason: two Templates at twice a week each is four Sessions expected, however
 * the Client divides them up.
 */
export const weeklyCompletion = (
    sessions: any[],
    /** This Client's Assignments. Inactive ones are filtered here, not by the caller. */
    assignments: any[],
    now?: number
): WeeklyCompletion => {
    // `!== false` rather than `=== true`, matching useClientAssignments: an
    // Assignment whose flag was somehow never written is treated as live, so a
    // missing field cannot silently erase what a Trainer expects.
    const active = (assignments ?? []).filter((assignment) => assignment.active !== false)

    return {
        completed: sessionsThisWeek(sessions ?? [], now).length,
        expected: active.length === 0 ? null : active.reduce((total, a) => total + (a.timesPerWeek ?? 0), 0),
    }
}
