// Sets store each measurement as a nullable field, so a set carries only the
// dimensions its exercise declares in `fields`.
const weightOf = (set) => set.weightKg ?? null

const eachSet = (workout, visit) => {
    for (const exercise of workout.exercises ?? []) {
        for (const set of exercise.sets ?? []) visit(set)
    }
}

// Loaded volume is reps x kg and nothing else. Carries and loaded holds score 0
// here on purpose: kg-metres and kg-seconds are different units, and summing all
// three into one figure gives a number that cannot be compared week to week - a
// 40kg carry over 20m would swamp a set of squats and then jump 50% just because
// the carry got 10m longer. They get their own totals below instead.
const volumeOf = (workout) => {
    let volume = 0
    eachSet(workout, (set) => {
        const weight = weightOf(set)
        if (weight != null && set.reps != null) volume += (Number(set.reps) || 0) * (Number(weight) || 0)
    })
    return volume
}

// The other two ways load gets applied: kg x metres for carries and sled work,
// kg x seconds for weighted iso holds.
const loadedBy = (workout, field) => {
    let total = 0
    eachSet(workout, (set) => {
        const weight = weightOf(set)
        if (weight != null && set[field] != null) {
            total += (Number(set[field]) || 0) * (Number(weight) || 0)
        }
    })
    return total
}

const loadedDistanceOf = (workout) => loadedBy(workout, 'distanceMeters')
const loadedTimeOf = (workout) => loadedBy(workout, 'durationSeconds')

const sumField = (workout, field) => {
    let total = 0
    eachSet(workout, (set) => {
        if (set[field] != null) total += Number(set[field]) || 0
    })
    return total
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The Sessions that count as "this week".
 *
 * The trailing seven days, deliberately, and not the calendar week. Target
 * Frequency is an expectation rather than a schedule (ADR 0001): there are no
 * due dates and nothing is ever overdue, so a boundary that resets to zero every
 * Monday morning would show every Client as having done nothing for the first
 * day and a half of it - which is not a fact about their training. A trailing
 * window answers the question a Trainer is actually asking, "are they doing it?",
 * and never lies at the start of a week.
 *
 * Exported so the completion ratio and the summary card above it mean the same
 * thing by "this week". Two windows on one screen, both labelled the same way,
 * would be a bug nobody could see.
 */
export const sessionsThisWeek = (workouts, now = Date.now()) =>
    workouts.filter((w) => w.date?.toMillis && now - w.date.toMillis() <= ONE_WEEK_MS)

export const computeWorkoutStats = (workouts) => {
    const thisWeek = sessionsThisWeek(workouts)

    const sum = (list, fn) => list.reduce((total, w) => total + fn(w), 0)

    // Most recent first, for a simple bar-style recent-volume view.
    const recent = workouts.slice(0, 5).map((w) => ({ id: w.id, date: w.date, volume: volumeOf(w) }))

    return {
        totalWorkouts: workouts.length,
        totalVolume: sum(workouts, volumeOf),
        totalLoadedDistance: sum(workouts, loadedDistanceOf),
        totalLoadedTime: sum(workouts, loadedTimeOf),
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
export const loadedDistanceForWorkout = loadedDistanceOf
export const loadedTimeForWorkout = loadedTimeOf
export const repsForWorkout = (workout) => sumField(workout, 'reps')
