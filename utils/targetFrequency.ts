// Target Frequency is the only expectation the model carries: how often a
// Trainer expects a Client to perform an assigned Workout Template. There is no
// calendar, no due date and no missed-workout state (ADR 0001), so this is
// stored as a plain count of times per week rather than as anything resembling
// a schedule.
//
// A count rather than a nested { period, times } object on purpose: per-week is
// the only period the domain has, and naming the field for its unit keeps the
// unit out of the reader's head. If a second period is ever needed it arrives
// as a new field, not as a reshaping of this one.

/** Fewer than once a week isn't a frequency this app can express. */
export const MIN_TIMES_PER_WEEK = 1

/** Twice a day, every day. Well past any real prescription; a typo guard. */
export const MAX_TIMES_PER_WEEK = 14

/**
 * What a Trainer gets when they first assign a Template.
 *
 * Two is a starting point, not a recommendation - the Trainer adjusts it on the
 * same screen, in the same breath as assigning.
 */
export const DEFAULT_TIMES_PER_WEEK = 2

export const clampTimesPerWeek = (timesPerWeek: number): number =>
    Math.min(MAX_TIMES_PER_WEEK, Math.max(MIN_TIMES_PER_WEEK, Math.round(timesPerWeek)))

/**
 * "2x / week", for a row that has room for three words.
 *
 * The multiplication sign is the typographic one rather than a letter x, since
 * it sits directly against a numeral.
 */
export const formatTargetFrequency = (timesPerWeek?: number | null): string =>
    timesPerWeek ? `${timesPerWeek}× / week` : 'No target set'
