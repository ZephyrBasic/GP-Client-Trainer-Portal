import { useEffect } from 'react'
import { Redirect, Stack } from 'expo-router'
import { Platform, StyleSheet, View } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'
import { SCREEN_PADDING } from '../constants/Layout'
import { useSignalFonts } from '../constants/Type'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { useProtectedRoute } from '../hooks/useProtectedRoute'
import ErrorBoundary from '../components/ErrorBoundary'
import { PlaceholderBar, PlaceholderRows } from '../components/Placeholder'
import Toast from '../components/Toast'
import { useHeaderOptions } from '../hooks/useHeaderOptions'
import '../utils/webFocus'
import ThemedView from '../components/ThemedView'
import { initCrashReporting } from '../utils/crashReporting'

// At module scope, and above every other import that could throw, because a
// reporter installed inside a component only ever hears about crashes that
// happened after the first render. Does nothing at all when no DSN is
// configured - see utils/crashReporting.ts.
initCrashReporting()

const RootLayoutNav = () => {
    const headerOptions = useHeaderOptions()
    const { loading } = useAuth()

    const redirectTo = useProtectedRoute()

    if (loading) {
        return (
            // The outline of a screen rather than a bare spinner
            // (.claude/rules/ui.md): signing in lands on a list, so a list's
            // shape is what fills the wait.
            <ThemedView style={styles.loading}>
                <PlaceholderBar width={140} height={28} />
                <View style={styles.loadingGap} />
                <PlaceholderRows count={4} />
            </ThemedView>
        )
    }

    if (redirectTo) {
        return <Redirect href={redirectTo} />
    }

    return (
        <>
            <Stack screenOptions={headerOptions}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <Toast />
        </>
    )
}

const RootLayout = () => {
    // app.json says `orientation: "default"` so that the how-to player can rotate
    // into landscape - on iOS a lock can never exceed the orientations declared
    // there, so declaring portrait-only would silently disable the feature. The app
    // is still portrait everywhere else, held here rather than in the manifest, and
    // components/YouTubePlayer.tsx is the only thing that lifts it.
    useEffect(() => {
        if (Platform.OS === 'web') return
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
    }, [])

    // Space Grotesk + IBM Plex Sans, loaded at runtime rather than bundled -
    // see constants/Type.ts. `fontsLoaded` gates the first frame so nothing
    // flashes in the system face and reflows a moment later. `fontError`
    // does NOT gate it: React Native has no CSS fallback-stack mechanism, so
    // if the font genuinely fails to load, the only fallback that exists is
    // rendering the system face on purpose - a font failure has to degrade
    // to that, never to a blank app stuck waiting for fonts that are never
    // coming.
    const [fontsLoaded, fontError] = useSignalFonts()
    if (!fontsLoaded && !fontError) {
        return null
    }

    // Outside AuthProvider rather than inside it: the provider is where the
    // Firestore profile listener lives, so a throw in there is exactly the kind
    // of crash that used to leave a white page, and a boundary nested under it
    // could not catch it.
    return (
        <ErrorBoundary>
            <AuthProvider>
                <RootLayoutNav />
            </AuthProvider>
        </ErrorBoundary>
    )
}

export default RootLayout

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 72,
    },
    loadingGap: {
        height: 24,
    },
})
