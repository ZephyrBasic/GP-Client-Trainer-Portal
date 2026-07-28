import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'

// Sorted client-side (rather than an orderBy in the query) so we don't need
// a composite Firestore index just for one client's own media feed.
export const useProgressMedia = (clientId) => {
    const [media, setMedia] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!clientId) {
            setMedia([])
            setLoading(false)
            return
        }

        setLoading(true)
        const mediaQuery = query(collection(db, 'progressMedia'), where('clientId', '==', clientId))
        const unsubscribe = onSnapshot(mediaQuery, (snapshot) => {
            const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            data.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
            setMedia(data)
            setLoading(false)
        })
        return unsubscribe
    }, [clientId])

    return { media, loading }
}
