// Sets store each measurement as a nullable field, so a set carries only the
// dimensions its exercise actually uses. `weight` is the legacy field name and is
// still read here so workouts logged before the exercise repository keep counting.
const weightOf = (set) => set.weightKg ?? set.weight ?? null

const eachSet = (workout, visit) => {
    for (const exercise of workout.exercises ?? []) {
        for (const set of exercise.sets ?? []) visit(set)
    }
}

// Loaded volume only - reps x kg. Bodyweight and timed work deliberately score 0
// here because adding them would mix units; they are surfaced as separate totals.
const volumeOf = (workout) => {
    let volume = 0
    eachSet(workout, (set) => {
        const weight = weightOf(set)
        if (weight != null && set.reps != null) volume += (Number(set.reps) || 0) * (Number(weight) || 0)
    })
    return volume
}

const sumField = (workout, field) => {
    let total = 0
    eachSet(workout, (set) => {
        if (set[field] != null) total += Number(set[field]) || 0
    })
    return total
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const computeWorkoutStats = (workouts) => {
    const now = Date.now()
    const thisWeek = workouts.filter((w) => w.date?.toMillis && now - w.date.toMillis() <= ONE_WEEK_MS)

    const sum = (list, fn) => list.reduce((total, w) => total + fn(w), 0)

    // Most recent first, for a simple bar-style recent-volume view.
    const recent = workouts.slice(0, 5).map((w) => ({ id: w.id, date: w.date, volume: volumeOf(w) }))

    return {
        totalWorkouts: workouts.length,
        totalVolume: sum(workouts, volumeOf),
        totalReps: sum(workouts, (w) => sumField(w, 'reps')),
        totalWorkSeconds: sum(workouts, (w) => sumField(w, 'durationSeconds')),
        totalDistanceMeters: sum(workouts, (w) => sumField(w, 'distanceMeters')),
        thisWeekVolume: sum(thisWeek, volumeOf),
        thisWeekReps: sum(thisWeek, (w) => sumField(w, 'reps')),
        recent,
        maxRecentVolume: Math.max(1, ...recent.map((r) => r.volume)),
    }
}

export const volumeForWorkout = volumeOf
export const repsForWorkout = (workout) => sumField(workout, 'reps')
