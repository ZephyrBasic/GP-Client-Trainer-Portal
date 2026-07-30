import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getChatId } from '../utils/chatId'

// Merges the trainer's client roster (always shown, even before a first
// message) with chat metadata (last message preview) so the trainer can
// start a conversation with any client, not just ones already messaged.
export const useTrainerChatList = (trainerId) => {
    const [clients, setClients] = useState([])
    const [chatMeta, setChatMeta] = useState({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!trainerId) return
        const clientsQuery = query(
            collection(db, 'users'),
            where('trainerId', '==', trainerId),
            where('role', '==', 'client')
        )
        const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
            setClients(snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() })))
            setLoading(false)
        })
        return unsubscribe
    }, [trainerId])

    useEffect(() => {
        if (!trainerId) return
        const chatsQuery = query(collection(db, 'chats'), where('trainerId', '==', trainerId))
        const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
            const meta = {}
            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data()
                meta[data.clientId] = { lastMessage: data.lastMessage ?? null, lastMessageAt: data.lastMessageAt ?? null }
            })
            setChatMeta(meta)
        })
        return unsubscribe
    }, [trainerId])

    const chats = clients
        .map((client) => ({
            client,
            chatId: getChatId(client.uid, trainerId),
            lastMessage: chatMeta[client.uid]?.lastMessage ?? null,
            lastMessageAt: chatMeta[client.uid]?.lastMessageAt ?? null,
        }))
        .sort((a, b) => (b.lastMessageAt?.toMillis?.() ?? 0) - (a.lastMessageAt?.toMillis?.() ?? 0))

    return { chats, loading }
}
