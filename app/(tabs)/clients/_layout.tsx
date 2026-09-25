import { Stack } from 'expo-router'
import { useHeaderOptions } from '../../../hooks/useHeaderOptions'

const ClientsLayout = () => {
    const headerOptions = useHeaderOptions()

    return (
        <Stack screenOptions={headerOptions}>
            <Stack.Screen name="index" options={{ title: 'Clients' }} />
            {/* [clientId] is a folder with a Stack of its own, so it draws its
                own header - the same reason the tabs set headerShown: false on
                this navigator one level up. Titling it here as well stacked two
                identical "Client" bars on top of each other. */}
            <Stack.Screen name="[clientId]" options={{ headerShown: false }} />
        </Stack>
    )
}

export default ClientsLayout
