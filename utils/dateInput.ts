/**
 * The day a Session counts for, as a DD-MM-YYYY text box holds it.
 *
 * Day-first because that is how this app's Clients write a date - the project
 * is Australian, and 04-09-2026 read as the 9th of April is the kind of error
 * nobody notices until a week's training is filed in the wrong month. The
 * stored value is a Timestamp either way; this format is only ever what the box
 * shows and what it accepts back.
 *
 * Both directions go through the **local** calendar, deliberately. The obvious
 * `new Date().toISOString().slice(0, 10)` is UTC, so it offers yesterday's date
 * to anyone training in the evening west of Greenwich, and its inverse
 * `new Date('2026-08-28')` parses the same string back as UTC midnight, which
 * lands on the previous day for those same Clients. A Session dated a day out is
 * a Session counted in the wrong week, which is what Target Frequency is
 * measured in.
 *
 * Shared by every screen with a date box - the live Session's finish card and
 * manual entry - because the two drifted apart once already: one grew this
 * comment and the fix, the other kept the bug the comment describes.
 */

import { pad } from './pad'

/** The shape the box shows and accepts, named once so the placeholder cannot drift from the parser. */
export const DATE_INPUT_FORMAT = 'DD-MM-YYYY'

/** The date as the input holds it: DD-MM-YYYY, in the device's own calendar. */
export const toDateInput = (date: Date): string =>
    `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`

/**
 * "Friday 4 September" - the calendar's own heading for the day currently
 * chosen, spelled out rather than repeated as digits directly under the box
 * that already shows them. It is the read-back that catches a typo.
 */
export const longDateLabel = (date: Date): string =>
    date.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        // The year only when it isn't this one. "Tuesday 1 January" under a box
        // holding 01-01-2030 hid the one part of the typo worth catching.
        ...(date.getFullYear() === new Date().getFullYear() ? null : { year: 'numeric' }),
    })

/**
 * "29 Aug" - the Signal history row's date, read in the device's own calendar
 * rather than a locale-numeric one. A history list is scanned rather than
 * read, so the month spelled out in three letters is what makes a row
 * recognisable at a glance; the numeric `8/29/2026` this replaces reads as one
 * more count on a row that already has two.
 */
export const shortDateLabel = (date: Date): string => `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`

/**
 * Three letters, always. Spelled out here rather than asked of the locale:
 * en-US puts the month first ("Sep 25"), and newer en-AU data says "Sept",
 * so the app wrote one date three ways depending on the screen.
 */
export const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The inverse: local midnight on that day, or null if the box doesn't hold one.
 *
 * Strict about the shape rather than handing the string to `new Date`, whose
 * tolerance is the problem - it accepts the format in a different timezone and
 * accepts a good deal that was never a date at all.
 */
export const parseDateInput = (value: string): Date | null => {
    // Separator-tolerant on the way in - 4/9/2026 and 04-09-2026 are the same
    // date, and a box that rejects the slash a Client's phone keyboard offers
    // first is a box that reads as broken. The day and month accept one digit
    // for the same reason; `toDateInput` always writes two.
    const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec((value ?? '').trim())
    if (!match) return null

    const [, day, month, year] = match.map(Number)
    const parsed = new Date(year, month - 1, day)
    if (Number.isNaN(parsed.getTime())) return null

    // `new Date(2026, 1, 31)` is the 3rd of March, silently. Reading the parts
    // back is what makes "31-02-2026" a rejected date rather than a surprising
    // one - the same strictness the YYYY-MM-DD regex used to get for free from
    // its fixed widths.
    return parsed.getDate() === day && parsed.getMonth() === month - 1 && parsed.getFullYear() === year
        ? parsed
        : null
}

/**
 * What is wrong with a Session's date box, or null when it holds a day a
 * Session can count for.
 *
 * A future day is refused: a Session is a record of training that happened,
 * and one dated next week would count towards a week nobody has trained yet.
 * Shared by the finish card and manual entry so the two refuse the same things
 * in the same words.
 */
export const sessionDateError = (value: string): string | null => {
    const parsed = parseDateInput(value)
    if (!parsed) return `Enter the date as ${DATE_INPUT_FORMAT}.`
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    return parsed > endOfToday ? "That date hasn't happened yet." : null
}
