import { collection, doc, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useFirestoreDoc, useFirestoreQuery } from './useFirestoreSnapshot'
import type { ExerciseWithSets } from '../utils/setDraft'

// A Workout Template is one object whoever wrote it: the author is a uid, never
// a role. A Client's own saved routine (ticket 12) is this same document with
// the Client as author, so nothing here may assume a Trainer.
//
//   workoutTemplates/{templateId}            identity: name, authorId, current Version pointer
//   workoutTemplates/{templateId}/versions/{versionId}   immutable contents
//
// The split is ADR 0002: Sessions cite the exact Version they ran, so contents
// are only ever appended to, while identity stays put across a year of
// progressions.
//
// The Template also carries two summaries of the Version it points at - the
// version number and the exercise count - so a list of Templates renders from
// one query instead of one query plus a read per row. Both are written in the
// same operation that moves the pointer, so neither can disagree with the
// Version it describes. Nothing else about a Version is copied up: a summary is
// worth denormalising only where it saves a round trip on bad signal.
const TEMPLATES = 'workoutTemplates'
const VERSIONS = 'versions'

// Versions are numbered from 1 and only ever counted upwards, so "Version 3"
// means the same thing to a Trainer and to the Client reading their history.
const FIRST_VERSION_NUMBER = 1

/**
 * One Exercise inside a Template Version - what the Client was asked for.
 *
 * The name is the domain's, the shape is `ExerciseWithSets` in utils/setDraft,
 * shared with a Session's `PerformedExercise`. A target Set and a performed Set
 * are different ideas even where they are the same fields, so both names stay;
 * one declaration is what keeps them from drifting apart while ticket 10 is
 * comparing one against the other.
 *
 * Its target Sets carry the same nullable measurements as performed Sets: a
 * measurement the Trainer left blank is `null`, so a bodyweight movement is
 * never prescribed as zero kilos.
 */
export type TemplateExercise = ExerciseWithSets

/**
 * The Templates one person authored.
 *
 * Sorted client-side by when each was last touched, so no composite index is
 * needed - see firestore.indexes.json, deliberately empty.
 */
export const useWorkoutTemplates = (authorId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (authorId ? query(collection(db, TEMPLATES), where('authorId', '==', authorId)) : null),
        [authorId],
        { sort: (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0) }
    )

    return { templates: data, loading, offline, retry }
}

/**
 * One Template's identity - name, author, and which Version is current.
 *
 * Its contents are not here: they live in the Version this points at, which
 * useTemplateVersion reads separately. Keeping them apart is what lets a list
 * render every Template's current Version number from one query.
 */
export const useWorkoutTemplate = (templateId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreDoc(
        () => (templateId ? doc(db, TEMPLATES, templateId) : null),
        [templateId]
    )

    return { template: data, loading, offline, retry }
}

/**
 * One Template Version, by id.
 *
 * Addressed by id rather than "the latest", because that is how every reader
 * needs it: the editor opens the Template's `currentVersionId`, and a Session
 * cites the exact Version it ran (ADR 0002), which may be any number of
 * progressions behind. A Version never changes once written, so a snapshot on
 * one is only ever a delivery mechanism - it will not fire twice with different
 * contents.
 */
export const useTemplateVersion = (templateId?: string | null, versionId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreDoc(
        () => (templateId && versionId ? doc(db, TEMPLATES, templateId, VERSIONS, versionId) : null),
        [templateId, versionId]
    )

    return { version: data, loading, offline, retry }
}

/**
 * The number the next Version will carry.
 *
 * Exported so the edit screen can name it - "saving publishes version 8" - from
 * the same arithmetic that writes it, rather than adding one in two places.
 */
export const nextVersionNumber = (currentVersionNumber?: number | null): number =>
    (currentVersionNumber ?? FIRST_VERSION_NUMBER) + 1

/**
 * Publishes the edited contents as a new Version and points the Template at it.
 *
 * Editing never rewrites a Version (ADR 0002): a Session that cited Version 7
 * must still find Version 7 saying what it said, so a progression appends.
 *
 * Written child-first, the opposite order from createWorkoutTemplate, and again
 * deliberately not a batch. The version-create rule resolves the parent's author
 * with get(); at creation the parent does not exist yet, so the parent goes
 * first, but here it already does, which frees the safer order: if the pointer
 * update fails the orphan is an unreferenced Version nobody reads, whereas the
 * reverse failure would leave the Template pointing at a Version that was never
 * written and its contents unreadable.
 *
 * `name` is Template identity, not Version contents, so it rides along with the
 * pointer update. The button still publishes either way - a Trainer editing a
 * workout should not have to work out which fields happen to be versioned.
 */
export const publishTemplateVersion = async ({
    templateId,
    name,
    exercises,
    currentVersionNumber,
}: {
    templateId: string
    name: string
    exercises: TemplateExercise[]
    /** The number the Template carries now; the new Version is one past it. */
    currentVersionNumber?: number | null
}): Promise<{ versionId: string; versionNumber: number }> => {
    const templateRef = doc(db, TEMPLATES, templateId)
    const versionRef = doc(collection(templateRef, VERSIONS))
    const versionNumber = nextVersionNumber(currentVersionNumber)

    await setDoc(versionRef, {
        versionNumber,
        exercises,
        createdAt: serverTimestamp(),
    })

    await updateDoc(templateRef, {
        name,
        currentVersionId: versionRef.id,
        currentVersionNumber: versionNumber,
        currentVersionExerciseCount: exercises.length,
        updatedAt: serverTimestamp(),
    })

    return { versionId: versionRef.id, versionNumber }
}

/**
 * A performed Session's Exercises, opened as target Sets for a new Template.
 *
 * A Session and a Template Version already hold the same shape
 * (`ExerciseWithSets`), so this copies rather than converts - but it copies
 * *deliberately* rather than handing the stored array straight to
 * `createWorkoutTemplate`. Three reasons, and each of them has a way of biting
 * later:
 *
 * - **Only the four fields a Version stores.** A Session document may carry
 *   more one day; spreading it whole would quietly version whatever that turns
 *   out to be.
 * - **An Exercise with no Sets is dropped.** A Session cannot contain one
 *   today - completion filters them - but a Template with an Exercise and no
 *   target Sets prescribes nothing, and this is the one place where that could
 *   arrive from outside.
 * - **The measurements are the ones that were performed.** What the Client
 *   actually lifted becomes what the Template asks for next time, which is the
 *   whole point of saving one: "do that again". It is not a prescription
 *   anybody wrote, so nothing about it is compared to anything - it becomes
 *   this Client's own Template like any other they authored (ADR 0001: there is
 *   no Program, only Templates).
 *
 * Sets are copied by value, so editing the new Template later cannot reach back
 * into the Session it came from. That matters: a Session is a record of
 * something that happened and is never rewritten.
 */
export const templateExercisesFrom = (exercises: any[] | null | undefined): TemplateExercise[] =>
    (exercises ?? [])
        .filter((exercise) => (exercise?.sets?.length ?? 0) > 0)
        .map((exercise) => ({
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            fields: [...(exercise.fields ?? [])],
            sets: exercise.sets.map((set) => ({ ...set })),
        }))

/**
 * The name to offer for a Template made out of a Session.
 *
 * The Exercise a Session led with, which is what a Client calls that workout
 * when they talk about it - "the deadlift one". A date would be the obvious
 * default and is the wrong one: a Template outlives the Session it came from
 * and gets performed for months, so "Workout 4 Sep" ages into a name that says
 * nothing, while "Conventional Deadlift + 2" still describes it.
 *
 * Only ever a suggestion - both callers put it in an editable box - so it has
 * to be plausible rather than right.
 */
export const suggestedTemplateName = (exercises: any[] | null | undefined): string => {
    const named = (exercises ?? []).filter((exercise) => exercise?.name)
    if (named.length === 0) return 'My workout'
    return named.length === 1 ? named[0].name : `${named[0].name} + ${named.length - 1}`
}

/**
 * Creates a Template and records its first Version, returning the Template id.
 *
 * A plain function rather than something the hook hands back, because authoring
 * needs the write without also subscribing to the whole list.
 */
export const createWorkoutTemplate = async ({
    authorId,
    name,
    exercises,
}: {
    authorId: string
    name: string
    exercises: TemplateExercise[]
}): Promise<string> => {
    // Both ids are minted locally so the Template can point at its first Version
    // in the same write, rather than being created pointerless and patched after
    // a read-back.
    const templateRef = doc(collection(db, TEMPLATES))
    const versionRef = doc(collection(templateRef, VERSIONS))

    // Written parent-first, and deliberately not as a batch: the rule guarding a
    // Version create reads its parent Template's author with get(), and rules
    // cannot see a sibling write in the same batch, so a batched pair would find
    // no parent and be denied. The window where the pointer leads nowhere is one
    // round trip, and only the author can see it.
    await setDoc(templateRef, {
        name,
        authorId,
        currentVersionId: versionRef.id,
        currentVersionNumber: FIRST_VERSION_NUMBER,
        currentVersionExerciseCount: exercises.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    })

    await setDoc(versionRef, {
        versionNumber: FIRST_VERSION_NUMBER,
        exercises,
        createdAt: serverTimestamp(),
    })

    return templateRef.id
}
