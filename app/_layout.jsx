import { Stack } from 'expo-router'
import { StyleSheet, useColorScheme } from 'react-native'
import { Colors } from '../constants/Colors'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { useProtectedRoute } from '../hooks/useProtectedRoute'
import ThemedView from '../components/ThemedView'

const RootLayoutNav = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { loading } = useAuth()

    useProtectedRoute()

    if (loading) {
        return <ThemedView style={styles.loading} />
    }

    return (
        <Stack screenOptions={{
            headerStyle: { backgroundColor: theme.navBackground },
            headerTintColor: theme.title,
        }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="index" options={{ title: 'Home' }} />
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
    }
})
