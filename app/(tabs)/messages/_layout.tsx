import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Colors } from '../../../constants/Colors'

const MessagesLayout = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: theme.navBackground },
                headerTintColor: theme.title,
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Messages' }} />
            <Stack.Screen name="[chatId]" options={{ title: 'Chat' }} />
        </Stack>
    )
}

export default MessagesLayout
