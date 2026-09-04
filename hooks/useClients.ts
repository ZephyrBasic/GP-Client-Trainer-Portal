import { collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useFirestoreQuery } from './useFirestoreSnapshot'

/**
 * One Trainer's roster.
 *
 * Rows are keyed `uid` rather than `id`, because that is what the id of a user
 * document is everywhere else in the app - getAssignmentId and getChatId both
 * take it as an auth uid.
 *
 * Sorted by name client-side: an orderBy alongside these equality filters is
 * exactly the shape that needs a composite index, and firestore.indexes.json is
 * deliberately empty.
 */
export const useClients = (trainerId?: string | null) => {
    const { data, loading, offline, retry } = useFirestoreQuery(
        () =>
            trainerId
                ? query(
                      collection(db, 'users'),
                      where('trainerId', '==', trainerId),
                      where('role', '==', 'client')
                  )
                : null,
        [trainerId],
        {
            idKey: 'uid',
            sort: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
        }
    )

    return { clients: data, loading, offline, retry }
}
