import { initializeApp, getApps, getApp } from 'firebase/app'
// getReactNativePersistence is only declared in @firebase/auth's React Native
// entry point (index.rn.d.ts). Metro resolves that entry, but tsc resolves a
// single entry for the whole project and picks the browser one, so the symbol
// exists at runtime on native while being invisible to the typechecker.
// @ts-expect-error -- see above; remove once firebase exports this from its root types
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// getReactNativePersistence needs a native AsyncStorage; on web, Firebase's
// default browser persistence (IndexedDB/localStorage) already works.
// initializeAuth throws if called twice on the same app (e.g. Fast Refresh),
// so fall back to the already-initialized instance in that case.
let authInstance
if (Platform.OS === 'web') {
    authInstance = getAuth(app)
} else {
    try {
        authInstance = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
    } catch (error) {
        authInstance = getAuth(app)
    }
}
export const auth = authInstance

// Firestore talks to the backend over a WebChannel stream by default, and the SDK
// tries to auto-detect the environments that need long polling instead. That
// detection is unreliable on Android and inside Expo Go, and when it guesses wrong
// the stream never establishes and every listener hangs silently. Forcing long
// polling on native trades a little latency for a connection that actually
// establishes; web keeps the default, where WebChannel genuinely works.
//
// Note this is a precaution, not a fix for anything observed: the outage that
// prompted it turned out to be broken DNS on the test device, which times out
// identically and would have defeated any transport. Don't read this as the cure
// for "Could not reach Cloud Firestore backend" - check name resolution first.
//
// initializeFirestore throws if the instance already exists (Fast Refresh), so
// fall back to it, exactly as the auth block above does.
let dbInstance
if (Platform.OS === 'web') {
    dbInstance = getFirestore(app)
} else {
    try {
        dbInstance = initializeFirestore(app, { experimentalForceLongPolling: true })
    } catch (error) {
        dbInstance = getFirestore(app)
    }
}
export const db = dbInstance

export const storage = getStorage(app)

export default app
