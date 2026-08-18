import { collection, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useFirestoreQuery } from './useFirestoreSnapshot'

export const useMessages = (chatId) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (chatId ? query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc')) : null),
        [chatId]
    )

    return { messages: data, loading, offline, retry }
}
