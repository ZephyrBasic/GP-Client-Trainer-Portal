// The shape of constants/exercises.json, and of the trainer-authored records
// that behave like it.
//
// Hand-written, unlike its sibling exerciseVocab.generated.ts: the vocabularies
// are derived from scripts/exerciseVocab.js and regenerated, but the record
// shape is not, so keeping them in separate files means regenerating can never
// clobber this.
//
// These definitions track validate-exercises.js deliberately - it is the runtime
// gate, this is the compile-time one, and they are meant to say the same thing.
// If you change one, change the other.

import type { Equipment, ExerciseTag, Facet, Modality, Muscle, Pattern, Role, SetField } from './exerciseVocab.generated'

export type { Equipment, ExerciseTag, Facet, Modality, Muscle, Pattern, Role, SetField }

/**
 * A window of a longer video, in whole seconds.
 *
 * Only meaningful alongside a YouTube `videoUrl`, and validate-exercises.js
 * rejects it on anything else: self-hosted clips are trimmed in the editor
 * before upload, so a window would be a second way to say the same thing.
 */
export interface VideoClip {
    start: number
    /** Exclusive end. `end - start` must fall inside the 15-45s house rule. */
    end: number
}

/**
 * A record in the bundled catalog.
 *
 * The six keys below are the whole schema: validate-exercises.js rejects any
 * other key outright, which is why this is an exact shape rather than an
 * extensible one. Notably absent, and absent on purpose: `typicalSets` /
 * `typicalReps` (a set is prefilled from that client's own last performance,
 * not from a generic prescription) and `aliases` (the search index derives
 * shorthand from the id instead).
 */
export interface ExerciseRecord {
    /**
     * Catalog id: a lowercase slug, `^[a-z0-9]+(-[a-z0-9]+)*$`.
     *
     * Ids stay abbreviated where names are spelled out - `sa-db-row` for
     * `Single-Arm Dumbbell Row` - and utils/exerciseSearch.ts indexes both, so
     * either form finds the record.
     */
    id: string

    /**
     * Display name, spelled out in full. No abbreviations, no superset prefixes
     * (`A1.`), no measurements baked in, no `/` either-ors or `+` combos - all
     * linted by validate-exercises.js.
     */
    name: string

    /**
     * Which measurements a set of this exercise takes. Non-empty, and ordered to
     * match SetField's declaration order (the order inputs render in).
     *
     * Denormalised onto each logged workout entry so history still renders
     * correctly if this record is later retagged or renamed.
     */
    fields: SetField[]

    /** Faceted tags, each `facet:value`, both halves from a closed vocabulary. */
    tags: ExerciseTag[]

    /**
     * Optional https link to a how-to demo, shown by the info button in the picker.
     *
     * Either a YouTube link (played in YouTube's iframe) or a direct media file
     * such as a Firebase Storage download URL (played by expo-video). Which one
     * is derived from the URL in utils/videoUrl.ts, not stored, so replacing a
     * borrowed clip with Zeph's own footage is a one-field edit.
     */
    videoUrl?: string

    /**
     * Which seconds of `videoUrl` to play, when the demo is buried in a longer
     * video. Absent means play the whole thing, which is the normal case for a
     * Short or for self-hosted footage.
     */
    clip?: VideoClip
}

/**
 * A trainer's own addition, from Firestore `customExercises/{id}`.
 *
 * Shaped like a catalog record on purpose, so the picker, the search index and
 * the log form treat bundled and custom identically. Two differences: the id is
 * namespaced so it can never collide with a bundled slug, and `isCustom` is set
 * by the hook (not stored) as the discriminant.
 */
export interface CustomExerciseRecord {
    /** Always `custom:{firestoreDocId}` - namespaced by hooks/useCustomExercises.ts. */
    id: `custom:${string}`
    isCustom: true
    name: string
    fields: SetField[]
    tags: ExerciseTag[]
    /** uid of the trainer who owns it. Clients can never create these - enforced in firestore.rules. */
    createdBy: string
    /** Firestore Timestamp, or null for the brief window before the server resolves it. */
    createdAt: unknown
    videoUrl?: string
    clip?: VideoClip
}

/**
 * Anything the picker, search index or log form can be handed.
 *
 * Prefer this over ExerciseRecord in UI code: a client's picker is always the
 * bundled catalog *plus* their trainer's additions, so code that only accepts
 * ExerciseRecord is quietly wrong.
 */
export type AnyExerciseRecord = ExerciseRecord | CustomExerciseRecord

/**
 * Reads one facet's values off a record's tags.
 *
 * Typed per-facet, so `tagValues(ex, 'muscle')` gives Muscle[] rather than
 * string[] and a typo'd comparison against the result fails to compile.
 */
export const tagValues = <F extends Facet>(
    exercise: Pick<AnyExerciseRecord, 'tags'>,
    facet: F
): FacetValue<F>[] => {
    const prefix = `${facet}:`
    return exercise.tags
        .filter((tag) => tag.startsWith(prefix))
        .map((tag) => tag.slice(prefix.length) as FacetValue<F>)
}

/** The value union belonging to a single facet. */
export type FacetValue<F extends Facet> = F extends 'muscle'
    ? Muscle
    : F extends 'pattern'
      ? Pattern
      : F extends 'modality'
        ? Modality
        : F extends 'role'
          ? Role
          : F extends 'equipment'
            ? Equipment
            : never
