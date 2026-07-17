import { initializeApp, getApps, getApp } from 'firebase/app'
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
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

export const db = getFirestore(app)
export const storage = getStorage(app)

export default app
