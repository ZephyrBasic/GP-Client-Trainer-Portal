const volumeOf = (workout) =>
    (workout.exercises ?? []).reduce(
        (exerciseTotal, exercise) =>
            exerciseTotal +
            (exercise.sets ?? []).reduce((setTotal, set) => setTotal + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0),
        0
    )

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const computeWorkoutStats = (workouts) => {
    const now = Date.now()

    const totalWorkouts = workouts.length
    const totalVolume = workouts.reduce((sum, w) => sum + volumeOf(w), 0)
    const thisWeekVolume = workouts
        .filter((w) => w.date?.toMillis && now - w.date.toMillis() <= ONE_WEEK_MS)
        .reduce((sum, w) => sum + volumeOf(w), 0)

    // Most recent first, for a simple bar-style recent-volume view.
    const recent = workouts.slice(0, 5).map((w) => ({ id: w.id, date: w.date, volume: volumeOf(w) }))
    const maxRecentVolume = Math.max(1, ...recent.map((r) => r.volume))

    return { totalWorkouts, totalVolume, thisWeekVolume, recent, maxRecentVolume }
}

export const volumeForWorkout = volumeOf
