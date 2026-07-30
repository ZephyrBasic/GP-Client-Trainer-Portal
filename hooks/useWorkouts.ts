import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'

// Sorted client-side (rather than an orderBy in the query) so we don't need
// a composite Firestore index just for one client's own workout list.
export const useWorkouts = (clientId?: string | null) => {
    const [workouts, setWorkouts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clientId) {
            setWorkouts([])
            setLoading(false)
            return
        }

        setLoading(true)
        const workoutsQuery = query(collection(db, 'workouts'), where('clientId', '==', clientId))
        const unsubscribe = onSnapshot(workoutsQuery, (snapshot) => {
            const data = snapshot.docs.map((docSnap): any => ({ id: docSnap.id, ...docSnap.data() }))
            data.sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0))
            setWorkouts(data)
            setLoading(false)
        })
        return unsubscribe
    }, [clientId])

    return { workouts, loading }
}
