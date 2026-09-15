import { createContext, useContext, useEffect, useState } from 'react'
import {
    createUserWithEmailAndPassword,
    deleteUser,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
} from 'firebase/auth'
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { SNAPSHOT_TIMEOUT_MS } from '../hooks/useFirestoreSnapshot'
import { deleteOwnAccount } from '../utils/deleteAccount'

const AuthContext = createContext(null)

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (I/O/0/1)

const generateInviteCode = () => {
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]
    }
    return code
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [profileLoading, setProfileLoading] = useState(true)
    const [offline, setOffline] = useState(false)
    // Held as its own state rather than read through `user.emailVerified`,
    // because `reload()` refreshes that flag by mutating the existing user
    // object in place - same reference, so React re-renders nothing and the
    // banner on Profile would never clear. See refreshVerification below.
    const [emailVerified, setEmailVerified] = useState(false)
    // True for the whole of a signUp call, success or failure. See signUp below
    // for why routing has to hold still while it is.
    const [signingUp, setSigningUp] = useState(false)

    // Track the Firebase auth user (signed in / signed out).
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser)
            setEmailVerified(firebaseUser?.emailVerified ?? false)
            setAuthLoading(false)
            if (!firebaseUser) {
                setProfile(null)
                setProfileLoading(false)
            }
        })
        return unsubscribe
    }, [])

    // Live-sync the Firestore profile doc for whoever is currently signed in.
    //
    // This listener can't use hooks/useFirestoreSnapshot: it feeds two pieces of
    // state (the profile, and the gate the whole app waits on) rather than the
    // helper's single { data, loading }. It applies the same timeout by hand,
    // and deliberately the same SNAPSHOT_TIMEOUT_MS - if this gate and the
    // screens underneath it used different thresholds they could disagree about
    // whether we are offline.
    useEffect(() => {
        if (!user) return

        setProfileLoading(true)
        setOffline(false)

        // The failure that made the app look permanently broken: while the device
        // can't reach Firestore, the SDK invokes *neither* callback below - it
        // queues the listener and keeps trying. So profileLoading stayed true,
        // `loading` never settled, and the root layout rendered its spinner
        // forever. An error callback cannot fix that; only a timeout can, because
        // it watches for data arriving rather than asking about the network.
        //
        // Releasing the gate does not cancel the listener: if the connection
        // returns at 30s the profile still arrives and `offline` clears itself.
        const timer = setTimeout(() => {
            console.warn('[auth] profile listener timed out; releasing the gate')
            setOffline(true)
            setProfileLoading(false)
        }, SNAPSHOT_TIMEOUT_MS)

        const unsubscribe = onSnapshot(
            doc(db, 'users', user.uid),
            { includeMetadataChanges: true },
            (snapshot) => {
                clearTimeout(timer)
                // fromCache means Firestore gave up reaching the server and
                // answered from the local cache - which, with no persistence on
                // native, is empty on a cold start. Verified: against an
                // unreachable backend this callback runs at ~11s with
                // `exists = false, fromCache = true`, cancelling the timeout
                // above and reporting a confident "you have no profile". Without
                // this check the app signs a lie rather than admitting an outage.
                const fromCache = snapshot.metadata?.fromCache === true
                if (!fromCache || snapshot.exists()) {
                    setProfile(snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null)
                }
                setProfileLoading(false)
                setOffline(fromCache)
            },
            (error) => {
                // The other half of the same bug: a listener that *errors* (rules
                // reject it, the token expires) also leaves the gate stuck without
                // this handler. Releasing it lets the signed-in UI render in
                // whatever degraded state it can manage.
                // The last known profile is deliberately kept: a dropped connection
                // shouldn't demote a trainer's session to a client's.
                clearTimeout(timer)
                console.warn('[auth] profile listener failed:', error)
                setProfileLoading(false)
                // A rules rejection is not an outage, and saying "you're offline"
                // would send the user to check their wifi over a permissions bug.
                setOffline(error?.code === 'unavailable')
            }
        )
        return () => {
            clearTimeout(timer)
            unsubscribe()
        }
    }, [user])

    const createAccount = async (email, password, { name, role, inviteCode, trainerCode }) => {
        // Firestore security rules only allow reading `users` docs to signed-in
        // accounts, so the auth account must exist before we can look up a
        // trainer's invite code. If that lookup fails, roll back the auth
        // account we just created rather than leaving an orphaned login with
        // no profile doc.
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        const signupProof = doc(db, 'users', credential.user.uid, 'private', 'signup')

        try {
            let trainerId = null
            let ownInviteCode = null

            if (role === 'client') {
                if (!inviteCode) {
                    throw new Error('An invite code from your trainer is required to register as a client.')
                }
                const trainerMatches = await getDocs(
                    query(collection(db, 'users'), where('inviteCode', '==', inviteCode.trim().toUpperCase()))
                )
                if (trainerMatches.empty) {
                    throw new Error("That invite code doesn't match any trainer. Double-check it and try again.")
                }
                trainerId = trainerMatches.docs[0].id
            } else if (role === 'trainer') {
                // The shared trainer signup code is checked by firestore.rules,
                // never here, and that is the whole design rather than a
                // preference. `users` is readable by any signed-in account - the
                // invite-code lookup three lines up is why - so a code this app
                // could compare against would be a code the first curious tester
                // could read out of Firestore and use to hand out trainer
                // accounts. Rules' get(), though, reads documents the client
                // cannot: the code lives at config/trainerSignup, which denies
                // read and write to everyone, and what the applicant typed goes
                // here, to a subcollection that is equally unreadable. The users
                // create rule compares the two, and neither value is ever
                // legible to a client.
                //
                // Written before the profile rather than batched with it, for the
                // same reason a Template is written before its first Version:
                // rules cannot see a sibling write in a batch, so a batch would
                // find no proof here and deny.
                //
                // Rotating the code is then a one-field edit in the Firebase
                // console - the console bypasses rules - with no rebuild and no
                // redeploy.
                await setDoc(signupProof, { trainerCode: (trainerCode ?? '').trim() })
                ownInviteCode = generateInviteCode()
            }

            await setDoc(doc(db, 'users', credential.user.uid), {
                name,
                email,
                role,
                trainerId: role === 'client' ? trainerId : null,
                inviteCode: role === 'trainer' ? ownInviteCode : null,
                createdAt: serverTimestamp(),
            })

            // The proof has done its job; keep no copy of a shared secret a user
            // typed. Best-effort - failing to tidy up must not fail a
            // registration that has already succeeded, and the document is
            // unreadable either way.
            await deleteDoc(signupProof).catch(() => {})

            // Verification is sent, not enforced. Failing to send must not fail
            // the signup: the account is real and usable, and Profile carries
            // both the state and a resend button for exactly this case.
            await sendEmailVerification(credential.user).catch((error) => {
                console.warn('[auth] could not send the verification email:', error)
            })
        } catch (error) {
            await deleteDoc(signupProof).catch(() => {})
            await deleteUser(credential.user).catch(() => {})

            // On the trainer path the only clause of the users create rule that
            // can fail is the code comparison, so a bare "insufficient
            // permissions" here means exactly one thing to the person reading
            // it. (It also covers config/trainerSignup not existing at all,
            // which fails closed on purpose: no code document, no new trainers.)
            if (role === 'trainer' && error?.code === 'permission-denied') {
                throw new Error(
                    "That trainer signup code isn't right. Ask us for the current one and try again."
                )
            }
            throw error
        }
    }

    /**
     * createAccount, with routing frozen for its duration.
     *
     * createUserWithEmailAndPassword signs the new account in before the invite
     * code or trainer signup code has been checked. Left alone, that flips `user`
     * while `profileLoading` is still false from being signed out, so the route
     * guard sees a signed-in user on an auth screen and redirects to the tabs -
     * unmounting the register screen mid-call. When the check then fails and the
     * account is rolled back, the guard sends the user to /login, and the error
     * explaining why is thrown into a screen that no longer exists. Seen as a
     * flash of Home followed by a silent return to login, for a wrong trainer
     * code and equally for a wrong client invite code.
     *
     * Holding `signingUp` keeps the register screen mounted until the call has
     * settled either way: on failure it shows the error, on success the guard
     * redirects as it always did, just once the profile is actually written.
     */
    const signUp = async (email, password, details) => {
        setSigningUp(true)
        try {
            await createAccount(email, password, details)
        } finally {
            setSigningUp(false)
        }
    }

    const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password)

    const signOut = () => firebaseSignOut(auth)

    /**
     * Sends a reset link, and tells the caller nothing about the address.
     *
     * Deliberately no ActionCodeSettings. A continue URL has to name a domain
     * listed under Authentication > Settings > Authorized domains, and passing
     * one that is not listed fails the send outright with
     * auth/unauthorized-continue-uri - which would turn the app's only route out
     * of a forgotten password into a dead end on the day someone needs it. The
     * default link lands on Firebase's own hosted action handler, which works
     * with no configuration at all. See docs/legal/ and the phase notes for what
     * to configure in the console to improve on it.
     *
     * Firebase also resolves this successfully for an address that has no
     * account when email-enumeration protection is on, which it should be - so
     * the screen's success copy must never promise that an email was sent.
     */
    const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim())

    /** Re-send the verification mail; the signup one gets lost or filtered. */
    const sendVerificationEmail = () => sendEmailVerification(auth.currentUser)

    /**
     * Re-reads the auth record so a just-verified user sees it here.
     *
     * `reload()` mutates the current user in place, so nothing derived from the
     * `user` reference changes - hence the separate `emailVerified` state this
     * writes into. Returns the fresh value so a screen can say "still not
     * verified" without waiting for a re-render.
     */
    const refreshVerification = async () => {
        if (!auth.currentUser) return false
        await auth.currentUser.reload()
        setEmailVerified(auth.currentUser.emailVerified)
        return auth.currentUser.emailVerified
    }

    /**
     * Deletes this account and the data it owns - see utils/deleteAccount.ts for
     * what that can and cannot reach, and for why a Trainer with Clients is
     * blocked. No local state is cleared afterwards on purpose: deleting the auth
     * account fires onAuthStateChanged with null, and the route guard in
     * app/_layout.tsx takes it from there.
     */
    const deleteAccount = (password) => deleteOwnAccount({ user: auth.currentUser, password })

    const value = {
        user,
        profile,
        // `signingUp` is excluded so the root layout does not swap the navigator
        // for its spinner mid-signup, which would unmount the register screen
        // just as surely as a redirect would.
        loading: authLoading || (!!user && profileLoading && !signingUp),
        signingUp,
        // True when we reached a screen without ever hearing back about the
        // profile. Screens that render off `profile` can use it to explain a
        // blank or stale account rather than just showing one.
        offline,
        emailVerified,
        signUp,
        signIn,
        signOut,
        resetPassword,
        sendVerificationEmail,
        refreshVerification,
        deleteAccount,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
