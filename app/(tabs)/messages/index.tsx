import { FlatList, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedCard from '../../../components/ThemedCard'
import Spacer from '../../../components/Spacer'
import ChatThread from '../../../components/ChatThread'
import { useAuth } from '../../../contexts/AuthContext'
import { useTrainerChatList } from '../../../hooks/useTrainerChatList'
import { getChatId } from '../../../utils/chatId'

const TrainerChatList = ({ trainerId, router }) => {
    const { chats, loading } = useTrainerChatList(trainerId)

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={chats}
                keyExtractor={(item) => item.chatId}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    loading ? (
                        <ThemedText style={styles.empty}>Loading...</ThemedText>
                    ) : (
                        <ThemedText style={styles.empty}>
                            No clients yet. Once clients link to you, they'll show up here.
                        </ThemedText>
                    )
                }
                ItemSeparatorComponent={() => <Spacer height={10} />}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() =>
                            router.push({
                                pathname: '/messages/[chatId]',
                                params: {
                                    chatId: item.chatId,
                                    clientId: item.client.uid,
                                    trainerId,
                                    name: item.client.name,
                                },
                            })
                        }
                    >
                        <ThemedCard>
                            <ThemedText title={true} style={styles.name}>
                                {item.client.name}
                            </ThemedText>
                            <ThemedText numberOfLines={1} style={styles.preview}>
                                {item.lastMessage ?? 'No messages yet'}
                            </ThemedText>
                        </ThemedCard>
                    </Pressable>
                )}
            />
        </ThemedView>
    )
}

const MessagesHome = () => {
    const { profile } = useAuth()
    const router = useRouter()

    if (profile?.role === 'client') {
        if (!profile.trainerId) {
            return (
                <ThemedView style={styles.container}>
                    <ThemedText>You don't have a trainer linked yet.</ThemedText>
                </ThemedView>
            )
        }
        const chatId = getChatId(profile.uid, profile.trainerId)
        return <ChatThread chatId={chatId} clientId={profile.uid} trainerId={profile.trainerId} />
    }

    return <TrainerChatList trainerId={profile?.uid} router={router} />
}

export default MessagesHome

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    listContent: {
        paddingBottom: 20,
    },
    empty: {
        marginTop: 10,
    },
    name: {
        fontSize: 16,
        marginBottom: 4,
    },
    preview: {
        opacity: 0.8,
    },
})
