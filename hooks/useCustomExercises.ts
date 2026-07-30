import { useEffect, useState } from 'react'
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase/config'

// Exercises a trainer has added beyond the bundled repository. Clients read their
// own trainer's additions so a program using a custom movement is still loggable.
export const useCustomExercises = (profile?: any) => {
    const [customExercises, setCustomExercises] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const ownerId = profile?.role === 'trainer' ? profile.uid : profile?.trainerId ?? null

    useEffect(() => {
        if (!ownerId) {
            setCustomExercises([])
            setLoading(false)
            return
        }

        setLoading(true)
        const customQuery = query(collection(db, 'customExercises'), where('createdBy', '==', ownerId))
        const unsubscribe = onSnapshot(
            customQuery,
            (snapshot) => {
                const data = snapshot.docs.map((docSnap): any => ({
                    // Namespaced so a custom exercise can never collide with a
                    // bundled repository id.
                    id: `custom:${docSnap.id}`,
                    isCustom: true,
                    ...docSnap.data(),
                }))
                data.sort((a, b) => a.name.localeCompare(b.name))
                setCustomExercises(data)
                setLoading(false)
            },
            () => {
                setCustomExercises([])
                setLoading(false)
            }
        )
        return unsubscribe
    }, [ownerId])

    // Shaped like a bundled catalog record (see constants/exercises.json) so the
    // picker, search index and log form treat custom and bundled the same.
    const addCustomExercise = async ({ name, fields, tags }: { name: string, fields: string[], tags: string[] }) => {
        if (profile?.role !== 'trainer') {
            throw new Error('Only trainers can add exercises to the library.')
        }
        await addDoc(collection(db, 'customExercises'), {
            name: name.trim(),
            fields,
            tags,
            createdBy: profile.uid,
            createdAt: serverTimestamp(),
        })
    }

    return { customExercises, loading, addCustomExercise }
}
