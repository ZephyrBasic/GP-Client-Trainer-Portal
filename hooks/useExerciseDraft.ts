import { useState } from 'react'

import type { AnyExerciseRecord, SetField } from '../types/exercise'
import { fieldsFor } from '../utils/exerciseSearch'
import { emptySetDraft, repeatSetDraft, setDraftFrom } from '../utils/setDraft'
import type { ExerciseWithSets, SetDraft } from '../utils/setDraft'

/**
 * One Exercise and its Sets while they are on screen - the draft twin of
 * `ExerciseWithSets` in utils/setDraft.
 *
 * Measurements are the strings their inputs carry and stay that way until a save
 * handler runs them through `storedSetFrom`. Nothing here parses or coerces
 * anything, because a half-typed "1" on the way to "12" is not a number and an
 * empty box is not a zero.
 *
 * The open index signature is deliberate: each screen hangs its own read-only
 * line off the row - manual entry a "last time" hint, the live Session the
 * target it was prescribed - and those are facts about that screen, not about a
 * draft.
 */
export type ExerciseDraft = {
    exerciseId: string
    name: string
    fields: SetField[]
    sets: SetDraft[]
    /**
     * Per-Set check-off, parallel to `sets`. Only the live Session carries it;
     * authoring a Template and logging one after the fact have nothing to tick
     * off, and the editor keys its checkbox column off this being present at
     * all. Kept in step with `sets` by `addSet` / `removeSet` below.
     */
    checked?: boolean[]
    [screenSpecific: string]: any
}

/**
 * Opens a stored list of Exercises for editing.
 *
 * Three screens hydrate from stored Exercises - editing a Workout Template,
 * setting one Client's target loads, and performing a prescribed Session - and
 * all three want the same thing from them: every measurement as the string its
 * input carries, and an absent one as an empty box rather than "0", so a plank
 * prescribed without a weight is not handed one just by being opened.
 *
 * The Sets are the stored ones, except that an Exercise with none gets a single
 * blank row. The editor hangs "+ Add Set" off the rows it renders, so an
 * Exercise with no rows could otherwise never be edited back up to having any.
 *
 * What a screen wants on top of that it maps on itself - the live Session's
 * checkbox column and the target line beside it are facts about that screen, not
 * about a draft.
 */
export const draftsFrom = (exercises: ExerciseWithSets[] | null | undefined): ExerciseDraft[] =>
    (exercises ?? []).map((exercise) => {
        const fields = exercise.fields ?? []
        const sets = (exercise.sets ?? []).map((set) => setDraftFrom(set, fields))
        return {
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            fields,
            sets: sets.length > 0 ? sets : [emptySetDraft(fields)],
        }
    })

/**
 * What a screen adds to a freshly picked Exercise, merged over the default row.
 *
 * The four screens differ only here: manual entry seeds the Sets from history,
 * the live Session opens an unticked row, and Template authoring starts blank.
 */
type NewRow = (exercise: AnyExerciseRecord, fields: SetField[]) => Partial<ExerciseDraft>

/**
 * The list of Exercises a screen is editing, and the five ways it changes.
 *
 * Four screens author the same block of state - manual entry, authoring a
 * Workout Template, editing one, and performing a Session - and every one of
 * them adds an Exercise, types into a Set, adds a Set, drops a Set and drops an
 * Exercise. Only the last of those five means anything different anywhere: the
 * live Session calls it skipping, because nothing has been written yet.
 *
 * What deliberately stays out:
 *
 * - **Save-time policy.** Template authoring keeps a row the author left blank,
 *   because the *number* of target Sets is part of the prescription; manual
 *   entry and check-off drop it, because a Set with no measurement never
 *   happened. That is one line in each screen's save handler, and unifying it
 *   here would silently prescribe less work.
 * - **Where the initial rows come from.** Hydrating from a Template Version or a
 *   Session document, the guards that make that one-shot, and the live Session's
 *   late merge of targets are each screen's own orchestration; they arrive here
 *   through `setExercises` like any other write.
 */
export const useExerciseDraft = (initial: ExerciseDraft[] = [], newRow?: NewRow) => {
    const [exercises, setExercises] = useState<ExerciseDraft[]>(() => initial)

    const mapExercise = (exIndex: number, update: (exercise: ExerciseDraft) => ExerciseDraft) =>
        setExercises((prev) => prev.map((ex, i) => (i === exIndex ? update(ex) : ex)))

    const pickExercise = (exercise: AnyExerciseRecord) => {
        // Denormalised - name and measurement fields both - so the row still
        // renders after the catalog is retagged or renamed.
        const fields = fieldsFor(exercise)
        setExercises((prev) => [
            ...prev,
            {
                exerciseId: exercise.id,
                name: exercise.name,
                fields,
                sets: [emptySetDraft(fields)],
                ...newRow?.(exercise, fields),
            },
        ])
    }

    const updateSet = (exIndex: number, setIndex: number, field: SetField, value: string) =>
        mapExercise(exIndex, (ex) => ({
            ...ex,
            sets: ex.sets.map((set, j) => (j === setIndex ? { ...set, [field]: value } : set)),
        }))

    // A new Set opens as a copy of the one above it rather than as empty boxes.
    // Sets within an Exercise repeat far more often than they differ - five at
    // the same load is the ordinary case - so the blank row was asking for the
    // same three numbers to be retyped four times, mid-workout, on a phone.
    // Carrying them forward makes the common case no typing at all and the
    // uncommon one exactly as much typing as before.
    //
    // Copied from the *last* row rather than from any target, on every screen
    // that adds Sets: authoring a Template repeats the load the author just
    // set, and a Client adding a sixth Set mid-Session repeats what they
    // actually just lifted, which is a better guess than the prescription they
    // may already have departed from. A first row on a freshly picked Exercise
    // is still `emptySetDraft` (see pickExercise) - there is nothing above it
    // to copy.
    //
    // It is a *default*, not a claim: every field stays editable, and the live
    // Session's new row still arrives unticked, so a copied number is only ever
    // recorded once the Client ticks it off.
    //
    // `checked` is parallel to `sets`, so adding or dropping a Set has to carry
    // it - otherwise the ticks slide onto the wrong rows. It is only rewritten
    // when the row already has one: a Template row must not grow a checkbox
    // column just by gaining a Set, and the editor keys that column off the prop
    // being present at all.
    const addSet = (exIndex: number) =>
        mapExercise(exIndex, (ex) => ({
            ...ex,
            sets: [...ex.sets, repeatSetDraft(ex.sets[ex.sets.length - 1], ex.fields)],
            ...(ex.checked ? { checked: [...ex.checked, false] } : null),
        }))

    const removeSet = (exIndex: number, setIndex: number) =>
        mapExercise(exIndex, (ex) => ({
            ...ex,
            sets: ex.sets.filter((_, j) => j !== setIndex),
            ...(ex.checked ? { checked: ex.checked.filter((_, j) => j !== setIndex) } : null),
        }))

    const removeExercise = (exIndex: number) => setExercises((prev) => prev.filter((_, i) => i !== exIndex))

    return { exercises, setExercises, pickExercise, updateSet, addSet, removeSet, removeExercise }
}
