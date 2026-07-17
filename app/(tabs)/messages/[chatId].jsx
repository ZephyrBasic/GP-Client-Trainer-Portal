import { Stack, useLocalSearchParams } from 'expo-router'
import ChatThread from '../../../components/ChatThread'

const ChatScreen = () => {
    const { chatId, clientId, trainerId, name } = useLocalSearchParams()

    return (
        <>
            <Stack.Screen options={{ title: name ?? 'Chat' }} />
            <ChatThread chatId={chatId} clientId={clientId} trainerId={trainerId} />
        </>
    )
}

export default ChatScreen
