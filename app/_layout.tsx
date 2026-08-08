import { useEffect } from 'react'
import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, Platform, StyleSheet, useColorScheme } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'
import { Colors } from '../constants/Colors'
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
                <ActivityIndicator size="large" color={Colors.primary} />
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
