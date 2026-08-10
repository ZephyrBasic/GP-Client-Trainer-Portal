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
    useEffect(() => {
        if (!user) return

        setProfileLoading(true)
        const unsubscribe = onSnapshot(
            doc(db, 'users', user.uid),
            (snapshot) => {
                setProfile(snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null)
                setProfileLoading(false)
            },
            (error) => {
                // Without this handler the listener fails silently: profileLoading
                // stays true, `loading` below never settles, and the root layout
                // renders its spinner forever - the app looks like it cannot start
                // rather than like it lost the network. Releasing the gate lets the
                // signed-in UI render in whatever degraded state it can manage.
                // The last known profile is deliberately kept: a dropped connection
                // shouldn't demote a trainer's session to a client's.
                console.warn('[auth] profile listener failed:', error)
                setProfileLoading(false)
            }
        )
        return unsubscribe
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
