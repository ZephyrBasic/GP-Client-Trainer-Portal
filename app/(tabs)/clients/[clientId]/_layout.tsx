import { Stack } from 'expo-router'
import { useHeaderOptions } from '../../../../hooks/useHeaderOptions'

const ClientDetailLayout = () => {
    const headerOptions = useHeaderOptions()

    return (
        <Stack screenOptions={headerOptions}>
            {/* The screen draws its own header - a circular back button, the
                Client's name and how much is prescribed to them - the same
                reason Today and the live Session switch theirs off too. */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="progress" options={{ title: 'Progress' }} />
            <Stack.Screen name="session/[id]" options={{ title: 'Session' }} />
        </Stack>
    )
}

export default ClientDetailLayout
