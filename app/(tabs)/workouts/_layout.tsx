import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Colors } from '../../../constants/Colors'

const WorkoutsLayout = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: theme.navBackground },
                headerTintColor: theme.title,
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Workouts' }} />
            <Stack.Screen name="new" options={{ title: 'Log Workout' }} />
            <Stack.Screen name="[id]" options={{ title: 'Workout' }} />
        </Stack>
    )
}

export default WorkoutsLayout
