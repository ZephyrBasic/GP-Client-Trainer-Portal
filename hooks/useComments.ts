import { collection, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useFirestoreQuery } from './useFirestoreSnapshot'

export const useComments = (mediaId) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (mediaId ? query(collection(db, 'progressMedia', mediaId, 'comments'), orderBy('createdAt', 'asc')) : null),
        [mediaId]
    )

    return { comments: data, loading, offline, retry }
}
