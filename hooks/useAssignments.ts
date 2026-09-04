import { useMemo } from 'react'
import { collection, doc, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getAssignmentId } from '../utils/assignmentId'
import type { TargetOverrides } from '../utils/prescription'
import { clampTimesPerWeek } from '../utils/targetFrequency'
import { useFirestoreDoc, useFirestoreQuery } from './useFirestoreSnapshot'

// An Assignment joins one Client to one Workout Template and carries that
// Client's Target Frequency and an active flag (ADR 0004).
//
//   assignments/{templateId}_{clientId}
//
// Top-level rather than a subcollection of the Template, because a Client has to
// be able to ask "what am I prescribed?" with one equality filter. Under
// workoutTemplates/{id}/assignments that question is a collection-group query,
// and the id has to stay derivable either way - see utils/assignmentId.
const ASSIGNMENTS = 'assignments'

/**
 * The Templates on one Client's list.
 *
 * `active` is filtered here rather than in the query, and the test is
 * `!== false` rather than `=== true`. A `where('active', '==', true)` would drop
 * any Assignment whose flag was somehow never written, silently emptying a
 * Client's list; treating only an explicit false as unassigned fails the safe
 * way round. The set is per-Client and small, so the filter costs nothing.
 *
 * Note the asymmetry with the rules: an inactive Assignment still keeps the
 * Client's read access to the Template alive (the rule tests existence, not the
 * flag), which is what keeps their past Sessions readable after a Trainer
 * unassigns. It just stops appearing on this list.
 */
export const useClientAssignments = (clientId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (clientId ? query(collection(db, ASSIGNMENTS), where('clientId', '==', clientId)) : null),
        [clientId],
        { sort: (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0) }
    )

    const assignments = useMemo(() => data.filter((a) => a.active !== false), [data])

    return { assignments, loading, offline, retry }
}

/**
 * The one Assignment joining a given Template to a given Client.
 *
 * A document read rather than a filter over a list, because the id is derived
 * from the pair (utils/assignmentId) so the path is already known - and because
 * the two callers want different halves of what a list would give them. The live
 * Session needs this Client's target loads whether or not they are still
 * assigned: unassigning soft-removes (ADR 0004), and a Session already in flight
 * must not silently swap a Client's own numbers for the shared plan's halfway
 * through. useClientAssignments honours `active` because it answers a different
 * question - "what should I be offered today?".
 *
 * Both the named Client and the owning Trainer may read it, so this serves the
 * Client performing the workout and the Trainer setting the loads.
 */
export const useAssignment = (templateId?: string | null, clientId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreDoc(
        () => (templateId && clientId ? doc(db, ASSIGNMENTS, getAssignmentId(templateId, clientId)) : null),
        [templateId, clientId]
    )

    return { assignment: data, loading, offline, retry }
}

/**
 * Every Assignment one Trainer has made, across all their Templates.
 *
 * The trainerId filter is not optional garnish: the read rule grants an
 * Assignment to its named Client or its owning Trainer, and rules are not
 * filters, so a query that doesn't constrain one of those two is rejected
 * outright rather than trimmed. Narrowing further to a single Template is left
 * to the caller, in memory, so one subscription serves both the assign screen
 * and anything later that wants a Trainer's Assignments as a whole.
 *
 * Inactive ones are included on purpose: the assign screen needs to know a
 * document already exists so it updates rather than creates, and re-assigning
 * after ticket 14 is an update to a document that never went away.
 */
export const useTrainerAssignments = (trainerId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (trainerId ? query(collection(db, ASSIGNMENTS), where('trainerId', '==', trainerId)) : null),
        [trainerId]
    )

    return { assignments: data, loading, offline, retry }
}

/**
 * Indexes a Trainer's Assignments by Client, for one Template.
 *
 * Kept next to the hooks rather than in the screen so the "which of my clients
 * has this?" lookup is written once.
 */
export const assignmentsByClient = (assignments: any[], templateId?: string | null) => {
    const byClient: Record<string, any> = {}
    assignments.forEach((assignment) => {
        if (assignment.templateId === templateId) byClient[assignment.clientId] = assignment
    })
    return byClient
}

/**
 * Puts a Template on a Client's list at the given Target Frequency.
 *
 * Deliberately not a `setDoc` merge for both cases. A create has to carry
 * clientId, templateId and trainerId - the rules verify all three against the
 * derived document id and against who owns what - while an update must leave
 * them untouched and must not reset `createdAt`. Writing them as two calls
 * keeps each payload honest about which of those it is.
 *
 * Per-Client target loads ride on this same document as `targetOverrides`, and
 * nothing is written for them here: absent means "no overrides", which is
 * exactly what utils/prescription reads it as. A newly assigned Client starts on
 * the Template's own targets, which is the right default.
 */
export const assignTemplateToClient = async ({
    templateId,
    clientId,
    trainerId,
    timesPerWeek,
    /** Whether an Assignment document for this pair already exists. */
    existing = false,
}: {
    templateId: string
    clientId: string
    trainerId: string
    timesPerWeek: number
    existing?: boolean
}): Promise<void> => {
    const ref = doc(db, ASSIGNMENTS, getAssignmentId(templateId, clientId))

    if (existing) {
        await updateDoc(ref, {
            timesPerWeek: clampTimesPerWeek(timesPerWeek),
            active: true,
            updatedAt: serverTimestamp(),
        })
        return
    }

    await setDoc(ref, {
        templateId,
        clientId,
        trainerId,
        timesPerWeek: clampTimesPerWeek(timesPerWeek),
        // Unassigning flips this rather than deleting the document, so that the
        // existence check the read rules depend on stays true (ADR 0004). It is
        // written explicitly at creation so no reader has to treat a missing
        // field as a third state.
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    })
}

/**
 * Takes a Template off a Client's list without taking their history with it.
 *
 * A soft removal, and the document is never deleted (ADR 0004). Three things
 * rest on the record surviving, and only the first is obvious:
 *
 * - the Client's past Sessions cite Versions of this Template, and the read rule
 *   on `workoutTemplates` grants those on an Assignment **existing** rather than
 *   on it being active. Delete the document and a finished block's history stops
 *   rendering - the Session keeps its denormalised name and its stored diff, but
 *   the Template and its Versions go dark;
 * - this Client's own target loads live on it as `targetOverrides`, so deleting
 *   would silently discard every load the Trainer had set for them, and
 *   re-assigning next month would start from the shared plan;
 * - the create rule verifies the derived id against the pair, so a document that
 *   still exists cannot be created over. Re-assigning is an update to a document
 *   that never went away, which is also why nothing can end up duplicated.
 *
 * `active` is what the Client's list honours, and it is the only field this
 * touches. Frequency and overrides stay exactly as they were, so re-assigning
 * restores the Client to the arrangement they were on rather than to a default.
 */
export const unassignTemplateFromClient = async ({
    templateId,
    clientId,
}: {
    templateId: string
    clientId: string
}): Promise<void> => {
    await updateDoc(doc(db, ASSIGNMENTS, getAssignmentId(templateId, clientId)), {
        active: false,
        updatedAt: serverTimestamp(),
    })
}

/**
 * Changes what a Trainer expects of one Client, and nothing else.
 *
 * Written on every tap rather than staged behind a Save button: there is then no
 * dirty state to lose on a back-swipe, and the snapshot the screen already
 * subscribes to echoes the change immediately through Firestore's latency
 * compensation, so the row updates offline too.
 */
export const setTargetFrequency = async ({
    templateId,
    clientId,
    timesPerWeek,
}: {
    templateId: string
    clientId: string
    timesPerWeek: number
}): Promise<void> => {
    await updateDoc(doc(db, ASSIGNMENTS, getAssignmentId(templateId, clientId)), {
        timesPerWeek: clampTimesPerWeek(timesPerWeek),
        updatedAt: serverTimestamp(),
    })
}

/**
 * Sets one Client's own target loads, and nobody else's.
 *
 * The whole map is replaced rather than merged field by field, because that is
 * what the Trainer just decided: an Exercise they put back to the Template's
 * numbers has to *lose* its override, and a merge would leave it there forever.
 * utils/prescription decides which entries the map contains; this only writes
 * what it is handed.
 *
 * Behind a Save button rather than written per keystroke, unlike the frequency
 * stepper beside it - a load is typed a digit at a time, and "60" on the way to
 * "600" is not a target anyone meant to prescribe.
 */
export const setTargetOverrides = async ({
    templateId,
    clientId,
    targetOverrides,
}: {
    templateId: string
    clientId: string
    targetOverrides: TargetOverrides
}): Promise<void> => {
    await updateDoc(doc(db, ASSIGNMENTS, getAssignmentId(templateId, clientId)), {
        targetOverrides,
        updatedAt: serverTimestamp(),
    })
}
