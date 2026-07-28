import EXERCISES from '../constants/exercises.json'

// Coaching shorthand used throughout the programs (e.g. "SA Lat Pulldown"),
// expanded so a client typing either form finds the same exercise.
const ABBREVIATIONS = {
    db: 'dumbbell',
    bb: 'barbell',
    kb: 'kettlebell',
    sa: 'single arm',
    sl: 'single leg',
    rdl: 'romanian deadlift',
    ohp: 'overhead press',
    wgs: "world's greatest stretch",
    sm: 'smith machine',
    dl: 'deadlift',
}

const normalise = (text) =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ABBREVIATIONS[word] || word)
        .join(' ')

export const buildIndex = (exercises) =>
    exercises.map((exercise) => ({
        exercise,
        haystack: normalise([exercise.name, ...(exercise.aliases ?? [])].join(' ')),
    }))

// Precomputed once at module load so keystroke filtering stays cheap. A trainer's
// custom exercises are indexed separately by the caller and passed in as `extra`.
const INDEX = buildIndex(EXERCISES)

const BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]))

export const getExerciseById = (id) => BY_ID.get(id) ?? null

export const allExercises = EXERCISES

/**
 * Ranked search: exact name, then prefix, then word-prefix, then substring.
 * Returns whole exercise records so the caller can read `type` for input rendering.
 * `extra` is a prebuilt index (see buildIndex) of custom exercises to search too.
 */
export const searchExercises = (queryText, limit = 50, extra = []) => {
    const index = extra.length ? [...extra, ...INDEX] : INDEX
    const query = normalise(queryText ?? '')
    if (!query) {
        return index
            .map((entry) => entry.exercise)
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, limit)
    }

    const scored = []
    for (const { exercise, haystack } of index) {
        let score = -1
        if (haystack === query) score = 0
        else if (haystack.startsWith(query)) score = 1
        else if (haystack.includes(` ${query}`)) score = 2
        else if (haystack.includes(query)) score = 3
        if (score >= 0) scored.push({ exercise, score })
    }

    scored.sort((a, b) => a.score - b.score || a.exercise.name.localeCompare(b.exercise.name))
    return scored.slice(0, limit).map((s) => s.exercise)
}

// Which set fields an exercise actually uses. Anything omitted is stored as null
// rather than 0, so "no weight" stays distinguishable from "lifted 0kg".
export const fieldsForType = (type) => {
    switch (type) {
        case 'weight_reps':
            return ['weightKg', 'reps']
        case 'bodyweight_reps':
            return ['reps']
        case 'duration':
            return ['durationSeconds']
        case 'distance_duration':
            return ['distanceMeters', 'durationSeconds']
        default:
            return ['reps']
    }
}
