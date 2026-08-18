import { collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useFirestoreQuery } from './useFirestoreSnapshot'

// Sorted client-side (rather than an orderBy in the query) so we don't need
// a composite Firestore index just for one client's own media feed.
export const useProgressMedia = (clientId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (clientId ? query(collection(db, 'progressMedia'), where('clientId', '==', clientId)) : null),
        [clientId],
        { sort: (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0) }
    )

    return { media: data, loading, offline, retry }
}
