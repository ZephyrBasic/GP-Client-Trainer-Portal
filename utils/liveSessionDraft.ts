/**
 * The Sets a Client has checked off in a Session that is still running.
 *
 * Deliberately in memory and deliberately not in Firestore. Check-off is local
 * state written once at completion (see hooks/useSessions): a write per Set
 * would multiply a workout's writes by roughly twenty, and a document rewritten
 * twenty times is not the immutable record that makes a Session trustworthy
 * history.
 *
 * It exists because the live screen unmounts the instant a Client swipes back to
 * their workout list - to check what they were prescribed, or by accident - and
 * half a workout's ticks is not something to lose to a gesture. Holding the
 * draft outside the component means coming back finds it exactly as it was.
 *
 * What it deliberately does not survive is the app itself being killed. Resuming
 * then re-prefills from the Template Version, and the ticks are gone, which is
 * the honest consequence of one write at the end: they were never anywhere else.
 * Persisting them would be a second, quieter store of what happened in a
 * workout, and the moment it disagreed with the Session there would be no way to
 * tell which was right.
 */

export type LiveSessionDraft = {
    exercises: any[]
    /**
     * Whether the Template Version's targets have been folded in yet.
     *
     * Carried with the ticks because it is a fact about them, not about the
     * screen: a Session opened on bad signal starts with no plan, and the live
     * screen merges the targets in if the Version arrives later. Without this
     * flag a Client who skipped an Exercise and swiped back would find it
     * restored on their return, the plan having been merged a second time into a
     * draft that had already deliberately dropped it.
     */
    planApplied: boolean
}

// Keyed by Session id rather than holding one draft, because a Client can leave
// the live screen, discard, and start again inside one run of the app - and a
// single slot would hand the new Session the old one's ticks.
const drafts = new Map<string, LiveSessionDraft>()

export const getLiveSessionDraft = (sessionId?: string | null): LiveSessionDraft | null =>
    (sessionId && drafts.get(sessionId)) || null

export const saveLiveSessionDraft = (
    sessionId: string,
    exercises: any[],
    planApplied: boolean
): void => {
    drafts.set(sessionId, { exercises, planApplied })
}

/** Called when a Session is saved or discarded - either way it is over. */
export const clearLiveSessionDraft = (sessionId?: string | null): void => {
    if (sessionId) drafts.delete(sessionId)
}
