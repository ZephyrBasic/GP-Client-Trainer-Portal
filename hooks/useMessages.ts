import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'

export const useMessages = (chatId) => {
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!chatId) {
            setMessages([])
            setLoading(false)
            return
        }

        setLoading(true)
        const messagesQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'))
        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            setMessages(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
            setLoading(false)
        })
        return unsubscribe
    }, [chatId])

    return { messages, loading }
}
