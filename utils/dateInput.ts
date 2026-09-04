/**
 * The day a Session counts for, as a YYYY-MM-DD text box holds it.
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

/** The date as the input holds it: YYYY-MM-DD, in the device's own calendar. */
export const toDateInput = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * "29 Aug" - the Signal history row's date, read in the device's own calendar
 * rather than a locale-numeric one. A history list is scanned rather than
 * read, so the month spelled out in three letters is what makes a row
 * recognisable at a glance; the numeric `8/29/2026` this replaces reads as one
 * more count on a row that already has two.
 */
export const shortDateLabel = (date: Date): string =>
    date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

/**
 * The inverse: local midnight on that day, or null if the box doesn't hold one.
 *
 * Strict about the shape rather than handing the string to `new Date`, whose
 * tolerance is the problem - it accepts the format in a different timezone and
 * accepts a good deal that was never a date at all.
 */
export const parseDateInput = (value: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim())
    if (!match) return null

    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return Number.isNaN(parsed.getTime()) ? null : parsed
}
