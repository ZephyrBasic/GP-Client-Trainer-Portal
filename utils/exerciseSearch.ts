import EXERCISES from '../constants/exerciseCatalog'
import type { SetField } from '../types/exercise'

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
    // Gym nicknames for the machines. These used to be carried as aliases on the
    // records themselves; with aliases gone they belong here, where one entry
    // covers every name the machine appears in.
    // ("erg" is deliberately absent - it would rewrite "ski erg" into "ski rowing
    // machine" and lose the Ski Erg.)
    rower: 'rowing machine',
    treddy: 'treadmill',
}

const words = (text) =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)

// Catalog names are singular by convention but nobody types them that way, and
// there are no longer plural aliases to catch it. Stripping a trailing "s" from
// every word on both sides makes "bicep curls" and "Bicep Curl" the same string.
// It mangles words like "press" -> "pres", which is harmless precisely because
// query and name go through it alike.
const singular = (word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)

// Expansions are themselves multi-word and may contain punctuation ("wgs" ->
// "world's greatest stretch"), so the result is cleaned a second time. Otherwise
// the expanded query never matches the equally-cleaned exercise name.
const normalise = (text) =>
    words(words(text).map((word) => ABBREVIATIONS[word] || word).join(' '))
        .map(singular)
        .join(' ')

// The catalog carries no aliases, so a record is found by its name alone. The id
// is indexed alongside it because ids stay abbreviated where names are spelled out
// ("sa-db-row" / "Single-Arm Dumbbell Row"), which is what keeps coaching shorthand
// searchable now that the spelling variants are gone.
export const buildIndex = (exercises) =>
    exercises.map((exercise) => ({
        exercise,
        labels: [
            { text: normalise(exercise.name), isName: true },
            { text: normalise(String(exercise.id).replace(/^custom:/, '').replace(/-/g, ' ')), isName: false },
        ],
    }))

// Precomputed once at module load so keystroke filtering stays cheap. A trainer's
// custom exercises are indexed separately by the caller and passed in as `extra`.
const INDEX = buildIndex(EXERCISES)

export const allExercises = EXERCISES

/**
 * Ranked search: exact name, then prefix, then word-prefix, then substring.
 * Returns whole exercise records so the caller can read `fields` for input rendering.
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

    // Rank a single label: exact, then prefix, then word-prefix, then substring.
    const rankLabel = (text) => {
        if (text === query) return 0
        if (text.startsWith(query)) return 1
        if (text.includes(` ${query}`)) return 2
        if (text.includes(query)) return 3
        return -1
    }

    const scored = []
    for (const { exercise, labels } of index) {
        let best = Infinity
        for (const { text, isName } of labels) {
            const rank = rankLabel(text)
            if (rank < 0) continue
            // Doubling leaves room for the name/id tiebreak without letting it
            // outweigh a genuinely better match rank.
            best = Math.min(best, rank * 2 + (isName ? 0 : 1))
        }
        if (best < Infinity) scored.push({ exercise, score: best })
    }

    // Equal-ranking matches are broken by name length: "Bicep Curl" is the answer
    // to "curl", not "Barbell Bicep Curl" - the plainer name is the base movement.
    scored.sort(
        (a, b) =>
            a.score - b.score ||
            a.exercise.name.length - b.exercise.name.length ||
            a.exercise.name.localeCompare(b.exercise.name)
    )
    return scored.slice(0, limit).map((s) => s.exercise)
}

// Which set fields an exercise actually uses. Anything omitted is stored as null
// rather than 0, so "no weight" stays distinguishable from "lifted 0kg".
//
// The catalog declares this per exercise instead of deriving it from a coarse
// `type`, which is how a loaded carry gets weight + distance and a plank gets
// duration alone. Custom exercises carry the same `fields` array.
// Annotated, unlike its neighbours, because the return crosses into
// ExerciseSetEditor's typed props: the array decides which columns render.
export const fieldsFor = (exercise): SetField[] => {
    const fields = exercise?.fields
    return Array.isArray(fields) && fields.length ? fields : ['reps']
}

/**
 * Tags are `facet:value` (see scripts/exerciseVocab.js). These read one facet off
 * an exercise so screens filter on meaning rather than on string prefixes.
 */
export const tagValues = (exercise, facet) => {
    const prefix = `${facet}:`
    return (exercise?.tags ?? [])
        .filter((tag) => tag.startsWith(prefix))
        .map((tag) => tag.slice(prefix.length))
}

// A tag value or a facet name, read for a person: 'lower-back' -> 'Lower Back'.
// Shared by the picker's facet sheet and ExerciseInfoModal, which both turned
// this into their own copy before it moved here.
export const titleCase = (value) =>
    value.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// The same value, kept lowercase - a picker row's meta line ("barbell ·
// squat") reads as a caption, not a heading, so it stays down at the row's
// own case rather than shouting a tag value at title case.
export const spaceCase = (value) => value.replace(/-/g, ' ')

const FACETS = ['muscle', 'pattern', 'modality', 'role', 'equipment']

/**
 * Which values of each facet actually appear on a bundled exercise, computed
 * once at module load the same way INDEX is.
 *
 * Deliberately not the full vocabulary in scripts/exerciseVocab.js: that list
 * is what a record's tags are validated against, not what the catalog uses,
 * and a facet sheet offering a value nothing carries would filter to an empty
 * list. Ninety-two is the real count across the five facets; the vocabulary
 * allows a few more that no record happens to use yet.
 */
export const FACET_VALUES = FACETS.reduce((acc, facet) => {
    const values = new Set()
    for (const exercise of EXERCISES) {
        for (const value of tagValues(exercise, facet)) values.add(value)
    }
    acc[facet] = Array.from(values).sort()
    return acc
}, {})
