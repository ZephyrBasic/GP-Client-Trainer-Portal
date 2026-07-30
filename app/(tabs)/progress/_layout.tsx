import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Colors } from '../../../constants/Colors'

const ProgressLayout = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: theme.navBackground },
                headerTintColor: theme.title,
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Progress' }} />
            <Stack.Screen name="[mediaId]" options={{ title: 'Progress' }} />
        </Stack>
    )
}

export default ProgressLayout
