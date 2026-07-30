import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native'
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
