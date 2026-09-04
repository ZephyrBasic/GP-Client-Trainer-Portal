import type { SetField } from '../types/exercise'

/**
 * A Set part-way through being typed. Every measurement is held as the raw
 * string its input carries, because "1" on the way to "12" is not yet a number
 * and an empty box is not a zero. Numbers appear only at the edges, in the two
 * converters below.
 */
export type SetDraft = Partial<Record<SetField, string>>

/**
 * A Set as it is stored: the measurements its Exercise declares and nothing
 * else, with `null` - never 0 - for one left blank. Target Sets on a Workout
 * Template and performed Sets in a Session share this shape.
 */
export type StoredSet = Partial<Record<SetField, number | null>>

/**
 * One Exercise and its Sets, as a Template Version or a Session stores it.
 *
 * The single declaration behind two domain names - `TemplateExercise` (what was
 * asked for) and `PerformedExercise` (what was done). Those stay distinct names
 * because they are distinct ideas and a signature saying which end it is reads
 * better, but they are not distinct shapes: ticket 10 compares one against the
 * other field by field, so a second declaration would let the two drift and the
 * comparison would quietly stop being total.
 *
 * It lives here rather than in either hook because both hooks already reach
 * into this module for `StoredSet`, whose meaning it inherits - a measurement
 * left blank is null in a target exactly as it is in a performed Set.
 *
 * The catalog record is denormalised - name and measurement fields both - so an
 * old Version or an old Session still renders after the catalog is retagged or
 * renamed.
 */
export type ExerciseWithSets = {
    exerciseId: string
    name: string
    fields: SetField[]
    sets: StoredSet[]
}

/** A blank row for an Exercise: one empty box per measurement it declares. */
export const emptySetDraft = (fields: SetField[]): SetDraft =>
    fields.reduce((acc, field) => ({ ...acc, [field]: '' }), {})

/**
 * The row "+ Add set" opens: the one above it, copied.
 *
 * Only the measurements the Exercise declares are carried across, so a copied
 * row can never smuggle in a field its Exercise doesn't measure - the same
 * guarantee `emptySetDraft` gives, which is what this falls back to when there
 * is no previous row (a freshly picked Exercise) or the previous row is blank
 * in every field. Copying blank boxes onto blank boxes is the same as opening
 * blank ones, so the fallback costs nothing and keeps the "no previous row"
 * case from needing its own branch at every call site.
 */
export const repeatSetDraft = (previous: SetDraft | undefined, fields: SetField[]): SetDraft =>
    fields.reduce((acc, field) => ({ ...acc, [field]: previous?.[field] ?? '' }), {})

/**
 * Opens a stored Set for editing. An absent measurement becomes an empty box
 * rather than "0", so a bodyweight movement doesn't gain a weight the moment
 * someone looks at it.
 */
export const setDraftFrom = (set, fields: SetField[]): SetDraft =>
    fields.reduce((acc, field) => ({ ...acc, [field]: set?.[field] != null ? String(set[field]) : '' }), {})

/**
 * Closes a draft back down for storage.
 *
 * A box left empty - or holding something that isn't a number - is stored as
 * null, which is the whole point: "no weight" and "lifted 0 kg" are different
 * facts, and a plank has no weight at all. Fields the Exercise doesn't declare
 * never appear, so the row carries only what it measures.
 */
export const storedSetFrom = (draft: SetDraft, fields: SetField[]): StoredSet =>
    fields.reduce((acc, field) => {
        const raw = String(draft?.[field] ?? '').trim()
        const parsed = Number(raw)
        acc[field] = raw !== '' && Number.isFinite(parsed) ? parsed : null
        return acc
    }, {})

/**
 * Whether a Set says anything at all. A 45s plank and a bodyweight pushup are
 * both complete without a weight, so one measurement is enough - but a row of
 * empty boxes is not a Set that happened.
 */
export const hasMeasurement = (set: StoredSet): boolean =>
    Object.values(set).some((value) => value != null)
