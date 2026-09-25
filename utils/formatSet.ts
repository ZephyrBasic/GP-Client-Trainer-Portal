// Renders a logged set from whichever fields it actually carries, which is the
// `fields` array its exercise declares in the repository.
export const formatSet = (set) => {
    const weight = set.weightKg ?? null
    const parts = []

    if (set.reps != null) parts.push(`${set.reps} reps`)
    if (weight != null && weight !== 0) parts.push(`${weight} kg`)
    if (set.durationSeconds != null) parts.push(formatDuration(set.durationSeconds))
    if (set.distanceMeters != null) parts.push(formatDistance(set.distanceMeters))

    if (parts.length === 0) return '-'
    // "12 reps x 60 kg" reads better than a comma list for the common weighted case.
    return set.reps != null && weight != null && weight !== 0 ? parts.join(' × ') : parts.join(' · ')
}

/**
 * A list of Sets said in one line, as "3 × 12 reps × 60 kg" for the usual
 * straight sets and as the full list when they differ - because collapsing a
 * ramp the Trainer deliberately prescribed would misstate what was asked for.
 *
 * Both places that show a prescription beside an editable copy of it - the
 * Trainer setting one Client's loads, the Client performing them - need exactly
 * this sentence, and two copies of it would eventually disagree about how a ramp
 * reads.
 *
 * Undefined when nothing is prescribed at all. What to say instead is the
 * caller's word: an empty target line is left off the row entirely, while the
 * Trainer's screen says so out loud.
 */
export const summariseSets = (sets) => {
    const formatted = (sets ?? []).map(formatSet).filter((text) => text !== '-')
    if (formatted.length === 0) return undefined

    const uniform = formatted.every((text) => text === formatted[0])
    return uniform ? `${formatted.length} × ${formatted[0]}` : formatted.join(', ')
}

/**
 * What a Client was asked for, said in one line and labelled as the target -
 * "Target 4 × 5 reps × 50 kg", with no colon, on every screen that shows one
 * (the review found four spellings of this one line).
 *
 * The prefix is spelled here rather than at each call site because both screens
 * that show a prescription beside an editable copy of it - performing a Session
 * live, and entering one afterwards against the same plan - have to say the same
 * word for it. `templateSummary` on the Trainer's target-loads screen keeps its
 * own prefix: it names a different thing, the plan everyone shares.
 *
 * Undefined when nothing was prescribed, so the caller can leave the line off
 * the row entirely rather than printing an empty label.
 */
export const targetSummary = (sets) => {
    const summary = summariseSets(sets)
    return summary && `Target ${summary}`
}

// Both of these are private: a Set's duration and distance are only ever
// rendered through formatSet above, and exporting them invited a second
// spelling of the same unit somewhere else.
const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}

const formatDistance = (metres) =>
    metres >= 1000 ? `${(metres / 1000).toFixed(metres % 1000 === 0 ? 0 : 2)} km` : `${metres} m`
