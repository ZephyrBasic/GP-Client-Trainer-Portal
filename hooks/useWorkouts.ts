import { collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useFirestoreQuery } from './useFirestoreSnapshot'

// Sorted client-side (rather than an orderBy in the query) so we don't need
// a composite Firestore index just for one client's own workout list.
export const useWorkouts = (clientId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (clientId ? query(collection(db, 'workouts'), where('clientId', '==', clientId)) : null),
        [clientId],
        { sort: (a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0) }
    )

    return { workouts: data, loading, offline, retry }
}
