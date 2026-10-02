import { useMemo } from 'react'
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useFirestoreDoc, useFirestoreQuery } from './useFirestoreSnapshot'
import type { SessionComparison } from '../utils/prescription'
import type { ExerciseWithSets } from '../utils/setDraft'

// A Session is a record of one workout a Client actually performed (CONTEXT.md).
// The collection was called `workouts` until scripts/migrate-workouts-to-sessions.js
// moved it; the name is exported for the one screen that still addresses a
// Session document directly, so it cannot drift from the hook. Every *write*
// lives in this module - a Session created outside it is how manual entry came
// to write documents with no `status` at all.
export const SESSIONS = 'sessions'

// A Session is live: it is created when a Client taps start and stays open while
// they train, so the same collection holds both a workout in flight and the
// history of finished ones.
//
//   active     started, still being performed. No performed Exercises yet -
//              check-off is local state and lands in one write at the end.
//   completed  what actually happened, and never edited again.
//
// There is deliberately no third state. A Session left open is resolved by the
// Client next time they open their workouts - resumed or discarded - rather than
// by a cleanup job marking it abandoned (ADR 0003).
export type SessionStatus = 'active' | 'completed'

/**
 * One Exercise as it was actually performed.
 *
 * The same declaration as a Template Version's `TemplateExercise` - see
 * `ExerciseWithSets` in utils/setDraft - because the two are one thing seen
 * from either end: what was asked for and what was done. Both names are kept so
 * a signature says which end it means; only the shape is shared, and sharing it
 * is what stops ticket 10's comparison from being written against two
 * declarations that can drift.
 */
export type PerformedExercise = ExerciseWithSets

/**
 * Whether this Session is the one in flight.
 *
 * The test is `=== 'active'` and not `!== 'completed'`, deliberately: every
 * Session logged before status existed carries neither value, and treating an
 * unlabelled document as active would offer a Client last March's workout back
 * as resume-or-discard. An unknown state is history, which fails the safe way.
 */
export const isActiveSession = (session: any): boolean => session?.status === 'active'

// Sorted client-side (rather than an orderBy in the query) so we don't need
// a composite Firestore index just for one client's own session list.
export const useSessions = (clientId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (clientId ? query(collection(db, SESSIONS), where('clientId', '==', clientId)) : null),
        [clientId],
        { sort: (a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0) }
    )

    // A Session in flight is not history. It carries no performed Exercises yet,
    // so leaving it in would put an empty workout at the top of the list and a
    // zero into every statistic, and would show a Trainer a session that has not
    // happened. Split here rather than in the three screens that read this, so
    // none of them can forget to.
    //
    // Two open at once is a product bug rather than a security one (ADR 0003):
    // the UI is what prevents it, so this takes the most recently dated, which is
    // the one the Client just started.
    const sessions = useMemo(() => data.filter((session) => !isActiveSession(session)), [data])
    const activeSession = useMemo(() => data.find(isActiveSession) ?? null, [data])

    return { sessions, activeSession, loading, offline, retry }
}

/**
 * One Session by id, live.
 *
 * The live screen needs this rather than the list: it is reached by a route
 * param, and it needs the Session's start timestamp and the Template Version it
 * cites before it can render anything. It stays subscribed on purpose, so a
 * Session discarded from another device closes the screen instead of saving over
 * a document that is no longer there.
 */
export const useSession = (sessionId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreDoc(
        () => (sessionId ? doc(db, SESSIONS, sessionId) : null),
        [sessionId]
    )

    return { session: data, loading, offline, retry }
}

/**
 * The three fields that say a Session was performed against a Workout Template.
 *
 * Absent, not null, and all three or nothing. A Self-Directed Session is one
 * performed against no Workout Template at all, so "was this prescribed work?"
 * is answered by whether the fields are there rather than by what they hold -
 * the same rule Sets follow for an unused measurement.
 *
 * The Version id is stored beside the Template id because a Template alone
 * reintroduces exactly the ambiguity versioning exists to remove (ADR 0002): it
 * would say which workout, but not which numbers. The name is denormalised so a
 * history list renders without resolving Versions, which matters on a phone with
 * poor signal.
 *
 * Written once here because both ways of recording a Session - live and entered
 * afterwards - have to obey it identically, or a back-dated Session (ticket 11)
 * could cite a Template without a Version.
 */
const prescribedFields = (
    templateId?: string | null,
    versionId?: string | null,
    templateName?: string | null
) => (templateId && versionId ? { templateId, versionId, templateName: templateName ?? '' } : {})

/**
 * The verdict, and the itemisation that justifies it.
 *
 * Absent for a Self-Directed Session, and absent too for a prescribed Session
 * whose Version never reached the phone - utils/prescription hands back null in
 * both cases and nothing is written. A neutral third verdict would claim we had
 * compared and found nothing to say; absence says we did not compare. Which of
 * the two it was is answered by `templateId`, which is written at start and
 * present either way.
 *
 * **The diff is stored beside the verdict rather than recomputed on read**, and
 * for a stronger reason than the verdict's own. Recomputing needs the Version -
 * a read that fails in exactly the basement this feature is built for, leaving a
 * Session that says Modified with no way to say what changed, which is the one
 * thing a Trainer opens it for. But it also needs the *Assignment*, and an
 * Assignment is mutable: a Trainer who adjusts a Client's loads next week would
 * change what recomputation produces, so a recomputed diff could contradict the
 * verdict stored beside it. Frozen together, the two can never disagree.
 *
 * The cost is bounded by the Session it describes - one entry per Set performed
 * or prescribed, each carrying at most four numbers twice - which is a few
 * kilobytes against Firestore's one-megabyte document, written once in the same
 * write as the Session and never rewritten. This is not the copy ADR 0002
 * refused: that was the *plan*, materialised once per Session where once per
 * Version would do. This is a judgement, and there is exactly one per Session.
 */
const verdictFields = (comparison?: SessionComparison | null) =>
    comparison ? { verdict: comparison.verdict, diff: comparison.exercises } : {}

/**
 * Opens a Session and returns its id, so the caller can navigate into it.
 *
 * Nothing performed is written here. The document is the open-session marker and
 * the start of the clock; the Sets a Client checks off stay in local state until
 * completeSession writes the lot in one go.
 *
 * ## Why this does not wait for the write
 *
 * The id is minted on the device and returned at once, and the write is left to
 * settle on its own. It used to be an awaited `addDoc`, whose promise resolves
 * only when the *server* has acknowledged the document - so tapping START did
 * nothing at all for a round trip, and in a gym basement that is the difference
 * between a stopwatch and a spinner. No transition can cover that gap; the only
 * fix is not to have it.
 *
 * Nothing is lost by not waiting. Firestore applies the write to its local
 * cache immediately, so the live screen's snapshot has the Session on its first
 * frame, offline included - and the clock is the device's own `startedAt`
 * (above), never the server's. A write that is ultimately rejected is a bug in
 * the rules rather than something a Client can cause or fix, so it is logged;
 * the screen it lands on already says the Session is not there.
 */
export const startSession = async ({
    clientId,
    templateId,
    versionId,
    templateName,
    startedBy,
}: {
    clientId: string
    /**
     * The Trainer running it for their Client, when it is one. The rules key off
     * it: a Trainer may finish or discard only a Session they started, and only
     * while it is live. Absent when the Client starts their own.
     */
    startedBy?: string | null
    /** All three together, or none of them - see below. */
    templateId?: string | null
    versionId?: string | null
    templateName?: string | null
}): Promise<string> => {
    const ref = doc(collection(db, SESSIONS))
    setDoc(ref, {
        clientId,
        status: 'active' as SessionStatus,
        // The device's clock, deliberately, where createdAt is the server's. The
        // timer starts the moment the screen opens and every elapsed figure is
        // derived from this value, but a serverTimestamp reads back as null until
        // the write is acknowledged - which in a gym basement may be never. This
        // is a stopwatch the Client is watching, not a fact about our backend.
        startedAt: Timestamp.now(),
        // The day it counts for. Written now so the document is well-formed and
        // sortable from the start, and rewritten at completion from a field the
        // Client can edit.
        date: Timestamp.now(),
        exercises: [],
        // Null, not 0: this Session has not happened yet, so its duration is
        // unrecorded rather than nothing. completeSession overwrites both from
        // the timer, and every reader already treats a missing duration as
        // unrecorded, so nothing has to change to accept the absence.
        durationSeconds: null,
        durationMinutes: null,
        notes: '',
        ...prescribedFields(templateId, versionId, templateName),
        ...(startedBy ? { startedBy } : {}),
        createdAt: serverTimestamp(),
    }).catch((err) => console.warn('[session] start was not accepted:', err))

    return ref.id
}

/**
 * Writes the whole performed Session, once.
 *
 * One write at the end rather than one per Set is the point, not an
 * optimisation: checking off twenty Sets would otherwise be twenty writes, and a
 * document rewritten twenty times is not the immutable record a Trainer can
 * trust as history.
 *
 * The verdict is written here too, in this same call, and never recomputed
 * afterwards (ADR 0002) - so it survives even if the Version it was judged
 * against later fails to resolve, and a Version published tomorrow cannot change
 * what a Session performed today is said to have been.
 */
export const completeSession = async ({
    sessionId,
    exercises,
    durationSeconds,
    durationMinutes,
    notes,
    date,
    comparison,
}: {
    sessionId: string
    exercises: PerformedExercise[]
    /**
     * How long it took, to the second - what the mm:ss box now holds.
     *
     * Written **alongside** `durationMinutes` rather than instead of it, and
     * that pairing is deliberate rather than lazy. Every Session recorded
     * before the box accepted seconds has only the minutes, so a reader has to
     * cope with their absence whatever we do here; writing both means no reader
     * *had* to change to keep working, and the ones that want the precise
     * figure ask for it and fall back (see sessionDurationLabel in
     * utils/elapsed). The two can never disagree because the minutes are
     * derived from the seconds at the call site, in one line, rather than
     * typed into a second box.
     *
     * Null if the Client cleared the box, which says the duration was not
     * recorded rather than that the workout took no time.
     */
    durationSeconds: number | null
    /** The same duration rounded to whole minutes - see above. */
    durationMinutes: number | null
    notes: string
    /** The day it counts for, which need not be today. */
    date: Date
    /**
     * What utils/prescription made of these Exercises against the targets they
     * ran - or null, and then no verdict is written at all. The caller compares
     * rather than this hook, because only the caller holds the targets: judging
     * against the raw Version here would mark every Client with their own loads
     * as Modified for lifting exactly what they were asked to.
     */
    comparison?: SessionComparison | null
}): Promise<void> => {
    await updateDoc(doc(db, SESSIONS, sessionId), {
        status: 'completed' as SessionStatus,
        // Client clock, for the same reason as startedAt: the pair brackets a
        // stopwatch, and a server value that resolves minutes later would make
        // the two disagree about how long the workout took.
        completedAt: Timestamp.now(),
        date: Timestamp.fromDate(date),
        exercises,
        durationSeconds,
        durationMinutes,
        notes,
        ...verdictFields(comparison),
    })
}

/**
 * Records a Session that has already happened, in one write.
 *
 * Manual entry has no live document to update: nothing was open and no timer
 * ran, so the Session is created already `completed`. It belongs here rather
 * than as an addDoc in the screen because every Session write living in one
 * module is what stops one of them omitting `status` - which is exactly what
 * the screen's own addDoc did. That was survivable only by accident, because
 * isActiveSession asks `=== 'active'` and so reads an unlabelled document as
 * history.
 *
 * Ticket 11 (back-dating against a Template) is this same call with the
 * prescribed fields and the comparison filled in, so a Session entered
 * afterwards earns a verdict instead of silently becoming Self-Directed. Both
 * parameters are already here, and both go through the same two helpers as a
 * live Session, so the absent-or-all rule cannot be obeyed differently at the
 * two ends.
 */
export const createManualSession = async ({
    clientId,
    exercises,
    durationSeconds,
    durationMinutes,
    notes,
    date,
    templateId,
    versionId,
    templateName,
    comparison,
}: {
    clientId: string
    exercises: PerformedExercise[]
    /** Typed by hand, and null when left blank - there was no timer to default it from. */
    durationSeconds: number | null
    /** The same duration rounded to whole minutes - see completeSession. */
    durationMinutes: number | null
    notes: string
    /** The day it counts for, which is the point: it is not today. */
    date: Date
    /** All three together, or none of them - see prescribedFields. */
    templateId?: string | null
    versionId?: string | null
    templateName?: string | null
    /** As completeSession: null, and this Session carries no verdict. */
    comparison?: SessionComparison | null
}): Promise<string> => {
    const ref = await addDoc(collection(db, SESSIONS), {
        clientId,
        status: 'completed' as SessionStatus,
        date: Timestamp.fromDate(date),
        exercises,
        durationSeconds,
        durationMinutes,
        notes,
        ...prescribedFields(templateId, versionId, templateName),
        ...verdictFields(comparison),
        // No startedAt and no completedAt, deliberately absent rather than
        // guessed: those two bracket a stopwatch, and this workout was not
        // timed. `date` carries the day it counts for and createdAt says when it
        // was written down, which is every instant we actually know.
        createdAt: serverTimestamp(),
    })

    return ref.id
}

/**
 * Throws away a Session that was started and never finished.
 *
 * A real delete, because there is nothing to keep: an active Session holds no
 * performed Sets, only the fact that a Client tapped start. Marking it abandoned
 * instead would leave every reader of this collection to filter out a state that
 * means nothing (ADR 0003).
 */
export const discardSession = async (sessionId: string): Promise<void> => {
    await deleteDoc(doc(db, SESSIONS, sessionId))
}
