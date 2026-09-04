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
 * The duration to offer at completion, in whole minutes.
 *
 * Rounded, and never below one: a Session that took fifty seconds took a minute
 * as far as a training log is concerned, and offering "0" would read as a
 * failure to record rather than as a short workout. It is only a default - the
 * Client can overwrite it, which is the whole reason the field is editable.
 */
export const minutesFromSeconds = (seconds: number): number => Math.max(1, Math.round(seconds / 60))

/**
 * The duration box read back, for the two screens that write a Session.
 *
 * Three outcomes, because the box has three states and coercing them to one
 * number is how a cleared box used to save as a 0-minute workout:
 *
 *   a number  what the Client settled on, in whole minutes
 *   null      the box was left empty - the duration was not recorded, which is
 *             a different fact from a Session that took no time. Every reader
 *             already renders a missing duration as "0 min", so nothing has to
 *             change to accept it.
 *   undefined the box holds something that is not a duration. The caller's cue
 *             to show an error and write nothing, which is the same standard
 *             the date box beside it is already held to.
 *
 * Zero and negatives are rejected rather than stored: a workout that took no
 * time did not happen, so a typed "0" is a mistake, not a measurement.
 */
export const parseDurationInput = (value: string): number | null | undefined => {
    const raw = (value ?? '').trim()
    if (raw === '') return null

    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined
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
