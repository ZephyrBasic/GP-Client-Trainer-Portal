import { useEffect } from 'react'
import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, Platform, StyleSheet, useColorScheme } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'
import { Colors } from '../constants/Colors'
import { useSignalFonts } from '../constants/Type'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { useProtectedRoute } from '../hooks/useProtectedRoute'
import ThemedView from '../components/ThemedView'

const RootLayoutNav = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { loading } = useAuth()

    const redirectTo = useProtectedRoute()

    if (loading) {
        return (
            <ThemedView style={styles.loading}>
                <ActivityIndicator size="large" color={theme.primary} />
            </ThemedView>
        )
    }

    if (redirectTo) {
        return <Redirect href={redirectTo} />
    }

    return (
        <Stack screenOptions={{
            headerStyle: { backgroundColor: theme.navBackground },
            headerTintColor: theme.title,
        }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
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

    return (
        <AuthProvider>
            <RootLayoutNav />
        </AuthProvider>
    )
}

export default RootLayout

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }
})
