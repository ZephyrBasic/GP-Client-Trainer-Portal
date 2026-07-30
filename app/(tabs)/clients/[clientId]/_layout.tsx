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
            <Stack.Screen name="index" options={{ title: 'Client' }} />
            <Stack.Screen name="progress" options={{ title: 'Progress' }} />
        </Stack>
    )
}

export default ClientDetailLayout
