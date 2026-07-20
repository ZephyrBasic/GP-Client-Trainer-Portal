/**
 * Builds a lookup of the last logged sets per exercise, most recent workout first.
 * Used to prefill the log form so a client repeating an exercise starts from what
 * they actually did last time rather than from an empty row.
 */
export const buildExerciseHistory = (workouts) => {
    const history = new Map()

    // `workouts` arrives newest-first from useWorkouts, so the first hit wins.
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
 * Prefill order: the client's own last performance, then the typical prescription
 * from the exercise repository, then blank. History wins because a stale program
 * number shouldn't override what the client has actually been lifting.
 */
export const prefillSetsFor = (exercise, history) => {
    const previous = history.get(exercise.id) ?? history.get(exercise.name)

    if (previous) {
        return previous.sets.map((set) =>
            FIELDS.reduce((acc, field) => {
                acc[field] = set[field] ?? (field === 'weightKg' ? set.weight ?? null : null)
                return acc
            }, {})
        )
    }

    const setCount = exercise.typicalSets ?? 3
    const blank = FIELDS.reduce((acc, field) => ({ ...acc, [field]: null }), {})
    return Array.from({ length: setCount }, () => ({
        ...blank,
        reps: exercise.typicalReps ?? null,
    }))
}

export const previousSetSummary = (exercise, history) => {
    const previous = history.get(exercise.id) ?? history.get(exercise.name)
    if (!previous) return null

    const parts = previous.sets.map((set) => {
        if (set.weightKg != null && set.reps != null) return `${set.reps}×${set.weightKg}kg`
        if (set.weight != null && set.reps != null) return `${set.reps}×${set.weight}kg`
        if (set.reps != null) return `${set.reps} reps`
        if (set.durationSeconds != null) return `${set.durationSeconds}s`
        if (set.distanceMeters != null) return `${set.distanceMeters}m`
        return null
    })

    const shown = parts.filter(Boolean)
    return shown.length ? `Last time: ${shown.join(', ')}` : null
}
