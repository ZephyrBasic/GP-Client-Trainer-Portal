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
            {/* Trainers never see this screen - the tab itself lands them on
                templates/ instead (app/(tabs)/_layout.tsx) - so the title only
                ever has to speak to a Client reading their own History. */}
            <Stack.Screen name="index" options={{ title: 'History' }} />
            <Stack.Screen name="new" options={{ title: 'Log Workout' }} />
            <Stack.Screen name="[id]" options={{ title: 'Workout' }} />
            {/* The live screen draws its own header - eyebrow, clock, progress -
                and its own footer, the same reason the Tabs bar is switched off
                for this route in app/(tabs)/_layout.tsx: Signal has it own the
                whole surface rather than sit under a second, generic header.
                Under workouts/ like everything else: the collection is
                `sessions` but the URL segment deliberately is not. */}
            <Stack.Screen name="session/[sessionId]" options={{ headerShown: false }} />
            {/* templates/ has no _layout of its own, so its routes flatten into
                this Stack and are named with the slash. A second nested Stack
                would only add a second header. */}
            <Stack.Screen name="templates/index" options={{ title: 'Workout Templates' }} />
            <Stack.Screen name="templates/new" options={{ title: 'New Template' }} />
            <Stack.Screen name="templates/[templateId]" options={{ title: 'Edit Template' }} />
            {/* assign/ sits beside [templateId] rather than under it, because a
                route can be a file or a folder but not both, and turning the
                editor into a folder would move it for no gain. */}
            <Stack.Screen name="templates/assign/[templateId]" options={{ title: 'Assign to Clients' }} />
            {/* Two dynamic segments, because a Client's target loads are a fact
                about the pair and nothing shorter identifies them - the same
                pair the Assignment's id is derived from. */}
            <Stack.Screen
                name="templates/targets/[templateId]/[clientId]"
                options={{ title: 'Client Targets' }}
            />
        </Stack>
    )
}

export default WorkoutsLayout
