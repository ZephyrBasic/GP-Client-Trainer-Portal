import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'

export const useComments = (mediaId) => {
    const [comments, setComments] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!mediaId) {
            setComments([])
            setLoading(false)
            return
        }

        setLoading(true)
        const commentsQuery = query(collection(db, 'progressMedia', mediaId, 'comments'), orderBy('createdAt', 'asc'))
        const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
            setComments(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
            setLoading(false)
        })
        return unsubscribe
    }, [mediaId])

    return { comments, loading }
}
