import { EmailAuthProvider, deleteUser, reauthenticateWithCredential } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, getDocsFromServer, query, where } from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { db, storage } from '../firebase/config'

/**
 * Deleting your own account, and as much of your own data as a client SDK can
 * reach.
 *
 * Required in-app by Apple guideline 5.1.1(v) and by Google Play, which also
 * wants a web page describing the same thing - see docs/legal/account-deletion-page.md.
 *
 * **There is no server.** Everything here runs as the signed-in user against
 * firestore.rules, which means this module can only delete what those rules let
 * that user delete. Several things it cannot are listed by `deletionNotes`
 * below and stated in the same words in the UI and in docs/legal/privacy.md,
 * because the one unacceptable answer is a confirm button that implies more than
 * it does. Erasing the remainder is a manual job against the Admin SDK, which is
 * why the policy names privacy@greenpulse.fit for it.
 */

/**
 * Why this Trainer may not delete themselves yet, or null if they may.
 *
 * A Trainer's Clients carry `trainerId` pointing at them, and firestore.rules
 * refuses *any* update that alters `trainerId` - on the Client's own document as
 * much as anyone else's (see CONTEXT.md: switching coach needs a gated path that
 * does not exist yet). So a Trainer who deletes themselves leaves every Client
 * linked to an account that is gone, with no way for the Client, the new
 * Trainer, or the app to repair it.
 *
 * The alternatives were worse. Cascading the delete across the Clients' own
 * records is not something a client SDK may do and should not be: that is other
 * people's training history. Silently orphaning them is the outcome this exists
 * to prevent. So the Trainer is blocked with a sentence that says what to do
 * instead, which is a legitimate answer to 5.1.1(v) - the guideline requires an
 * account-deletion path, not that it be unconditional, and a Trainer with no
 * Clients left can delete in one tap.
 *
 * Held here rather than in firestore.rules because rules cannot run a query and
 * so cannot count Clients - the same limit that puts the single-active-Session
 * rule in the UI (ADR 0003). It is a product rule, not a security boundary, and
 * nothing could make it one: Firebase Auth always lets an account delete itself.
 */
export const trainerDeletionBlock = (role: string, clientCount: number | null): string | null => {
    if (role !== 'trainer') return null
    // Unknown is not zero. A roster that is still loading, offline, or errored
    // reports an empty list, and treating that as "no Clients" would unblock
    // exactly the deletion this guard exists to stop - in a gym basement, of
    // all places. So an unknown count blocks, and says why.
    if (clientCount == null) {
        return "We couldn't check whether you still coach anyone, so deleting is paused. Check your connection and try again."
    }
    if (clientCount === 0) return null
    const n = clientCount === 1 ? '1 client' : `${clientCount} clients`
    return `You still coach ${n}. Deleting now would leave them linked to an account that no longer exists, and nothing in the app could re-link them to a new trainer. Move them across first, or email privacy@greenpulse.fit and we'll do it for you.`
}

/** What deletion takes with it, in the words the confirm screen shows. */
export const deletionTakes = (role: string): string[] =>
    role === 'trainer'
        ? ['Your name, email and invite code', 'Any custom exercises you added', 'Your sign-in']
        : [
              'Your name, email and the trainer you are linked to',
              'Every session you have logged, and the sets in them',
              'Any progress photos or videos you uploaded',
              'Your sign-in',
          ]

/**
 * What survives, and why. Shown to the user before they confirm, because a
 * delete that quietly leaves things behind is the one outcome worth more than a
 * paragraph of honesty.
 */
export const deletionNotes = (role: string): string[] =>
    role === 'trainer'
        ? [
              'Workout templates you wrote stay in the database. They become unreadable to everyone, because their author no longer exists, but nothing in the app can remove them - past sessions are built on them, so the rules refuse to delete one.',
              'Email privacy@greenpulse.fit if you want those erased too.',
          ]
        : [
              'Workout templates you saved yourself, and the record that your trainer assigned you work, stay in the database. Sessions are built on them, so the rules refuse to delete one.',
              'Messages you sent your trainer stay in their conversation, the same way a sent email does.',
              'Email privacy@greenpulse.fit if you want those erased too.',
          ]

/**
 * Deletes the signed-in account and the data it owns.
 *
 * Re-authenticates first rather than waiting for `auth/requires-recent-login`
 * from the final step. Two reasons, and the second is the real one: reacting to
 * that error would mean discovering the session is too old *after* the Firestore
 * data is already gone, leaving a half-deleted account; and typing your password
 * is the confirmation step this screen wants anyway - a destructive action that
 * costs one tap is a destructive action people take by accident.
 *
 * Order matters. The profile document goes last of the Firestore writes, because
 * other collections' rules resolve `users/{uid}.trainerId` through get() and a
 * missing profile changes what they answer. The auth account goes last of all:
 * once it is gone the SDK is signed out and nothing else can be written.
 */
export const deleteOwnAccount = async ({
    user,
    password,
}: {
    /** The Firebase auth user - `user` from useAuth. */
    user: any
    /** Their current password, for re-authentication. */
    password: string
}): Promise<void> => {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))

    const uid = user.uid

    // The Trainer guard again, and this time it is the one that counts. The
    // sheet's count comes from a live snapshot, which can be answered from a
    // stale cache; this asks the server, before a single document is deleted, so
    // a Client who registered a minute ago is still seen. getDocsFromServer
    // rather than getDocs because the latter silently falls back to the cache
    // offline - and deleting an account needs the network regardless.
    //
    // Not branched on role, for the same reason as the queries below: for a
    // Client this comes back empty, since no one's trainerId is a Client's uid.
    const roster = await getDocsFromServer(
        query(collection(db, 'users'), where('trainerId', '==', uid), where('role', '==', 'client'))
    )
    const blocked = trainerDeletionBlock('trainer', roster.size)
    if (blocked) throw new Error(blocked)

    // Queried by uid rather than branched on role, deliberately: this is "delete
    // everything keyed to you", and a profile whose `role` failed to load must
    // not quietly skip a collection. The queries a Trainer runs come back empty,
    // which costs one read each and cannot be wrong.
    const sessions = await getDocs(query(collection(db, 'sessions'), where('clientId', '==', uid)))
    await Promise.all(sessions.docs.map((row) => deleteDoc(row.ref)))

    // The Storage object and the Firestore row are two deletes, and the object
    // goes first: a failed object delete with the row already gone would leave a
    // file nothing in the app can name. Each one is allowed to fail on its own -
    // an object that was never uploaded, or already swept - without failing the
    // account deletion around it.
    const media = await getDocs(query(collection(db, 'progressMedia'), where('clientId', '==', uid)))
    for (const row of media.docs) {
        const storagePath = row.data()?.storagePath
        if (storagePath) {
            await deleteObject(ref(storage, storagePath)).catch(() => {})
        }
        // Comments a trainer left on this media are a subcollection, and
        // Firestore does not delete subcollections with their parent - nor may
        // this user, since comments are immutable once posted. They are
        // unreachable afterwards rather than gone. deletionNotes does not say so,
        // deliberately for now: progress media is switched off (CLAUDE.md), so no
        // Client can have any. Re-enabling it must add that line to the notes.
        await deleteDoc(row.ref)
    }

    const customExercises = await getDocs(
        query(collection(db, 'customExercises'), where('createdBy', '==', uid))
    )
    await Promise.all(customExercises.docs.map((row) => deleteDoc(row.ref)))

    // Whatever the signup gate wrote (see AuthContext.signUp) is normally
    // cleared the moment registration succeeds. Swept again here because it is
    // the one document under this user that nobody - including them - can read
    // to check.
    await deleteDoc(doc(db, 'users', uid, 'private', 'signup')).catch(() => {})

    // Before the profile, which is where the code is read from. Left behind, it
    // would sign the next Client who types it up to a Trainer who no longer
    // exists. A Client has no code, so there is nothing to delete. Swallowed
    // because the rule reads the document's trainerId, so a code that was never
    // written fails as a denial - and the only code this user could fail to
    // delete is one that does not exist.
    const ownInviteCode = (await getDoc(doc(db, 'users', uid))).data()?.inviteCode
    if (ownInviteCode) {
        await deleteDoc(doc(db, 'inviteCodes', ownInviteCode)).catch(() => {})
    }

    await deleteDoc(doc(db, 'users', uid))

    await deleteUser(user)
}
