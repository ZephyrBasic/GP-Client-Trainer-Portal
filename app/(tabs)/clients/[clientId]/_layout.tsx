import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Colors } from '../../../../constants/Colors'

const ClientDetailLayout = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: theme.navBackground },
                headerTintColor: theme.title,
            }}
        >
            {/* The screen draws its own header - a circular back button, the
                Client's name and how much is prescribed to them - the same
                reason Today and the live Session switch theirs off too. */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="progress" options={{ title: 'Progress' }} />
        </Stack>
    )
}

export default ClientDetailLayout
