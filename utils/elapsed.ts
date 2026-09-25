/**
 * How long a Session has been running, and how to say it.
 *
 * Every figure here is a subtraction between two instants. Nothing counts ticks
 * and nothing accumulates: a live screen re-renders once a second only so the
 * number on screen moves, and a tick missed while the app is backgrounded,
 * throttled by the browser, or asleep in a pocket costs nothing, because the
 * next render recomputes the truth from the start timestamp.
 */

import { pad } from './pad'

/** Whole seconds between two instants; never negative, and 0 with no start. */
export const elapsedSecondsBetween = (
    startMillis?: number | null,
    nowMillis: number = Date.now()
): number => (startMillis ? Math.max(0, Math.floor((nowMillis - startMillis) / 1000)) : 0)

/**
 * The running clock: mm:ss, growing an hours field only once there is one.
 *
 * A workout is minutes long, so the common case stays two fields wide and does
 * not jump around as it passes ten minutes.
 */
export const formatElapsed = (seconds: number): string => {
    const safe = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(safe / 3600)
    const minutes = Math.floor((safe % 3600) / 60)
    const rest = safe % 60

    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`
}

/**
 * The duration to record, in whole minutes.
 *
 * Rounded, and never below one: a Session that took fifty seconds took a minute
 * as far as a training log is concerned, and storing "0" would read as a
 * failure to record rather than as a short workout. Since the box became
 * mm:ss this is no longer what the Client types - it is derived from the
 * seconds they settled on, so the `durationMinutes` every existing reader
 * renders keeps meaning exactly what it always did.
 */
export const minutesFromSeconds = (seconds: number): number => Math.max(1, Math.round(seconds / 60))

/**
 * The duration box, filled from the clock: mm:ss, or h:mm:ss past an hour.
 *
 * The same shape `formatElapsed` puts in the live header, deliberately - the
 * figure the Client has been watching for the last forty minutes is the figure
 * the finish card offers them, character for character, so there is nothing to
 * reconcile between the two.
 */
export const formatDurationInput = (seconds: number): string => formatElapsed(seconds)

/** mm:ss, or h:mm:ss - what the box accepts and what the clock hands it. */
const CLOCK_INPUT = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/

/**
 * The duration box read back **in seconds**, for the two screens that write a
 * Session.
 *
 * Three outcomes, because the box has three states and coercing them to one
 * number is how a cleared box used to save as a 0-minute workout:
 *
 *   a number  what the Client settled on, in whole seconds
 *   null      the box was left empty - the duration was not recorded, which is
 *             a different fact from a Session that took no time. Every reader
 *             already renders a missing duration as "0 min", so nothing has to
 *             change to accept it.
 *   undefined the box holds something that is not a duration. The caller's cue
 *             to show an error and write nothing, which is the same standard
 *             the date box beside it is already held to.
 *
 * Two forms are accepted, and the second only because dropping it would break
 * a habit for no gain:
 *
 *   "4:30" / "1:04:30"  minutes and seconds, which is what the box now offers
 *   "45"                bare minutes, the form this box held before mm:ss
 *
 * A bare number is read as **minutes**, not seconds. That is the one genuinely
 * ambiguous input, and minutes is the reading that keeps every duration typed
 * before this change meaning what its author meant - a Client who types "45"
 * for a 45-minute session must not get 45 seconds.
 *
 * Zero and negatives are rejected rather than stored: a workout that took no
 * time did not happen, so a typed "0" is a mistake, not a measurement.
 */
export const parseDurationInput = (value: string): number | null | undefined => {
    const raw = (value ?? '').trim()
    if (raw === '') return null

    const clock = CLOCK_INPUT.exec(raw)
    if (clock) {
        const [, hours, minutes, rest] = clock
        // Rejected rather than carried: "4:75" is a typo, and normalising it to
        // 5:15 would silently record a duration nobody entered.
        if (Number(rest) > 59) return undefined
        if (hours != null && Number(minutes) > 59) return undefined

        const seconds = Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(rest)
        return seconds > 0 ? seconds : undefined
    }

    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) * 60 : undefined
}

/**
 * How long a Session took, for the screens that show it back.
 *
 * Reads `durationSeconds` where a Session has one and falls back to
 * `durationMinutes`, which is every Session recorded before the box accepted
 * seconds - and is still written alongside the precise figure, so nothing that
 * only knows about minutes had to change. Absent in both means the duration was
 * not recorded, and the caller leaves the whole clause off rather than printing
 * a zero.
 */
export const sessionDurationLabel = (session: any): string | null => {
    const seconds = session?.durationSeconds
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
        // Past an hour, "1h 12m" beats a five-digit clock in a list row.
        if (seconds >= 3600) {
            const hours = Math.floor(seconds / 3600)
            const minutes = Math.round((seconds % 3600) / 60)
            return minutes ? `${hours}h ${minutes}m` : `${hours}h`
        }

        // Under it, the mm:ss the Client typed - but without the clock's
        // leading zero. The running header pads so the number doesn't jump
        // about once a second; a finished row is read once, and "4:30 min"
        // reads as a duration where "04:30 min" reads as a timestamp.
        return `${formatElapsed(seconds).replace(/^0/, '')} min`
    }

    const minutes = session?.durationMinutes
    return typeof minutes === 'number' ? `${minutes} min` : null
}

/**
 * How long ago something started, in the coarsest unit that is still true.
 *
 * Used to say when a Session was left open. Precision past the unit shown would
 * be false comfort: the question is "did I forget to finish this?", and the
 * answer is the difference between twenty minutes and yesterday.
 */
export const formatAgo = (seconds: number): string => {
    const safe = Math.max(0, Math.floor(seconds))
    if (safe < 60) return 'just now'

    const minutes = Math.floor(safe / 60)
    if (minutes < 60) return `${minutes} min ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
        const rest = minutes % 60
        return rest ? `${hours}h ${rest}m ago` : `${hours}h ago`
    }

    const days = Math.floor(hours / 24)
    return days === 1 ? 'yesterday' : `${days} days ago`
}

// Longer than any workout, with room for a phone left running through lunch.
// Past this, the figure is a typo (999999) rather than a long day.
const MAX_SESSION_SECONDS = 12 * 3600

/**
 * What is wrong with a Session's duration box, or null when it can be saved -
 * blank included, which records the duration as unknown.
 */
export const durationError = (value: string): string | null => {
    const seconds = parseDurationInput(value)
    if (seconds === undefined) return 'Enter minutes and seconds, as 45:00, or leave it blank.'
    if (seconds != null && seconds > MAX_SESSION_SECONDS) return 'That is over 12 hours. Check the duration, or leave it blank.'
    return null
}
