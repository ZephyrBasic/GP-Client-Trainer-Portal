import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

// One-time (non-live) name lookups for a set of uids, cached across calls -
// used to show a comment author's name without a persistent listener per
// comment (names essentially never change mid-session).
export const useUserNames = (uids: string[]) => {
    const [names, setNames] = useState<Record<string, string>>({})
    const key = uids.join(',')

    useEffect(() => {
        const unique = [...new Set(uids)].filter((uid) => uid && !(uid in names))
        if (unique.length === 0) return

        let cancelled = false
        Promise.all(
            unique.map(async (uid) => {
                const snapshot = await getDoc(doc(db, 'users', uid))
                return [uid, snapshot.exists() ? snapshot.data().name : 'Unknown']
            })
        )
            .then((entries) => {
                if (cancelled) return
                setNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
            })
            .catch((err) => {
                // Not an onSnapshot, but the same failure shape: offline these
                // getDocs reject (or hang) and, unhandled, left every comment
                // author showing "..." forever plus an unhandled rejection.
                // Resolve to a stated unknown instead of a permanent placeholder.
                if (cancelled) return
                console.warn('[users] name lookup failed:', err)
                setNames((prev) => ({
                    ...prev,
                    ...Object.fromEntries(unique.map((uid) => [uid, 'Unknown'])),
                }))
            })

        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])

    return names
}
