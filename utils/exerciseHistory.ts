/**
 * Builds a lookup of the last logged sets per exercise, most recent workout first.
 * Used to prefill the log form so a client repeating an exercise starts from what
 * they actually did last time rather than from an empty row.
 */
export const buildExerciseHistory = (workouts) => {
    const history = new Map()

    // Sessions arrive newest-first from useSessions, so the first hit wins.
    for (const workout of workouts) {
        for (const exercise of workout.exercises ?? []) {
            const key = exercise.exerciseId ?? exercise.name
            if (!key || history.has(key)) continue
            const sets = (exercise.sets ?? []).filter(Boolean)
            if (sets.length === 0) continue
            history.set(key, { sets, date: workout.date ?? null })
        }
    }

    return history
}

const FIELDS = ['reps', 'weightKg', 'durationSeconds', 'distanceMeters']

/**
 * Prefill from the client's own last performance, or nothing at all.
 *
 * The catalog deliberately carries no typical sets/reps: a first-time exercise
 * starts empty so the client enters what they actually did, rather than being
 * anchored to a generic prescription they then have to correct.
 */
export const prefillSetsFor = (exercise, history) => {
    const previous = history.get(exercise.id) ?? history.get(exercise.name)
    if (!previous) return []

    return previous.sets.map((set) =>
        FIELDS.reduce((acc, field) => {
            acc[field] = set[field] ?? null
            return acc
        }, {})
    )
}

export const previousSetSummary = (exercise, history) => {
    const previous = history.get(exercise.id) ?? history.get(exercise.name)
    if (!previous) return null

    const parts = previous.sets.map((set) => {
        if (set.weightKg != null && set.reps != null) return `${set.reps}×${set.weightKg}kg`
        if (set.reps != null) return `${set.reps} reps`
        if (set.durationSeconds != null) return `${set.durationSeconds}s`
        if (set.distanceMeters != null) return `${set.distanceMeters}m`
        return null
    })

    const shown = parts.filter(Boolean)
    return shown.length ? `Last time: ${shown.join(', ')}` : null
}
