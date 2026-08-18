import { useMemo } from 'react'
import { collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getChatId } from '../utils/chatId'
import { useFirestoreQuery } from './useFirestoreSnapshot'

// Merges the trainer's client roster (always shown, even before a first
// message) with chat metadata (last message preview) so the trainer can
// start a conversation with any client, not just ones already messaged.
export const useTrainerChatList = (trainerId) => {
    const {
        data: clients,
        loading,
        offline: clientsOffline,
        retry: retryClients,
    } = useFirestoreQuery(
        () =>
            trainerId
                ? query(
                      collection(db, 'users'),
                      where('trainerId', '==', trainerId),
                      where('role', '==', 'client')
                  )
                : null,
        [trainerId],
        { idKey: 'uid' }
    )

    const { data: chatDocs, offline: chatsOffline, retry: retryChats } = useFirestoreQuery(
        () => (trainerId ? query(collection(db, 'chats'), where('trainerId', '==', trainerId)) : null),
        [trainerId]
    )

    const chatMeta = useMemo(() => {
        const meta = {}
        chatDocs.forEach((chat) => {
            meta[chat.clientId] = {
                lastMessage: chat.lastMessage ?? null,
                lastMessageAt: chat.lastMessageAt ?? null,
            }
        })
        return meta
    }, [chatDocs])

    const chats = clients
        .map((client) => ({
            client,
            chatId: getChatId(client.uid, trainerId),
            lastMessage: chatMeta[client.uid]?.lastMessage ?? null,
            lastMessageAt: chatMeta[client.uid]?.lastMessageAt ?? null,
        }))
        .sort((a, b) => (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0))

    const retry = () => {
        retryClients()
        retryChats()
    }

    // Either listener failing means the list on screen is not the truth: an
    // unreachable roster hides clients outright, unreachable chat metadata
    // silently shows stale previews. Both are worth the banner.
    return { chats, loading, offline: clientsOffline || chatsOffline, retry }
}
