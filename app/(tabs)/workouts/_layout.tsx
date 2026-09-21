import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Colors } from '../../../constants/Colors'
import { isFromToday } from '../../../hooks/useLeave'

// Today opens some of this Stack's screens from another tab. Those draw their
// own entrance (components/ScreenEnter) and go back to Today rather than down
// this Stack (hooks/useLeave), so the native push is switched off - two
// motions at once otherwise - and so is the swipe, which would pop to
// whatever happened to be underneath. Pushed from within this tab, they
// behave like any other screen.
const todayDetour = ({ route }) =>
    isFromToday(route.params) ? { animation: 'none' as const, gestureEnabled: false } : {}

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
            <Stack.Screen name="new" options={(props) => ({ title: 'Log Workout', ...todayDetour(props) })} />
            <Stack.Screen name="[id]" options={{ title: 'Workout' }} />
            {/* The live screen draws its own header - eyebrow, clock, progress -
                and its own footer, the same reason the Tabs bar is switched off
                for this route in app/(tabs)/_layout.tsx: Signal has it own the
                whole surface rather than sit under a second, generic header.
                Under workouts/ like everything else: the collection is
                `sessions` but the URL segment deliberately is not. */}
            {/* Always a detour from Today (see todayDetour above), so never
                the push or the swipe, whatever its params say. */}
            <Stack.Screen
                name="session/[sessionId]"
                options={{ headerShown: false, animation: 'none', gestureEnabled: false }}
            />
            {/* templates/ has no _layout of its own, so its routes flatten into
                this Stack and are named with the slash. A second nested Stack
                would only add a second header. */}
            <Stack.Screen name="templates/index" options={{ title: 'Workout Templates' }} />
            <Stack.Screen
                name="templates/new"
                options={(props) => ({ title: 'New Template', ...todayDetour(props) })}
            />
            <Stack.Screen
                name="templates/[templateId]"
                options={(props) => ({ title: 'Edit Template', ...todayDetour(props) })}
            />
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
