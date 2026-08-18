import { createContext, useContext, useEffect, useState } from 'react'
import {
    createUserWithEmailAndPassword,
    deleteUser,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
} from 'firebase/auth'
import {
    collection,
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

    // Track the Firebase auth user (signed in / signed out).
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser)
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

    const signUp = async (email, password, { name, role, inviteCode }) => {
        // Firestore security rules only allow reading `users` docs to signed-in
        // accounts, so the auth account must exist before we can look up a
        // trainer's invite code. If that lookup fails, roll back the auth
        // account we just created rather than leaving an orphaned login with
        // no profile doc.
        const credential = await createUserWithEmailAndPassword(auth, email, password)

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
        } catch (error) {
            await deleteUser(credential.user).catch(() => {})
            throw error
        }
    }

    const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password)

    const signOut = () => firebaseSignOut(auth)

    const value = {
        user,
        profile,
        loading: authLoading || (!!user && profileLoading),
        // True when we reached a screen without ever hearing back about the
        // profile. Screens that render off `profile` can use it to explain a
        // blank or stale account rather than just showing one.
        offline,
        signUp,
        signIn,
        signOut,
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
