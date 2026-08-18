import { useMemo } from 'react'
import { addDoc, collection, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useFirestoreQuery } from './useFirestoreSnapshot'

// Exercises a trainer has added beyond the bundled repository. Clients read their
// own trainer's additions so a program using a custom movement is still loggable.
export const useCustomExercises = (profile?: any) => {
    const ownerId = profile?.role === 'trainer' ? profile.uid : profile?.trainerId ?? null

    // This one already had an error callback, but that only ever covered half the
    // problem: an unreachable backend invokes no callback at all, so it still hung.
    // Going through the shared helper is what adds the timeout.
    const { data, loading, offline, retry } = useFirestoreQuery(
        () => (ownerId ? query(collection(db, 'customExercises'), where('createdBy', '==', ownerId)) : null),
        [ownerId],
        { sort: (a, b) => a.name.localeCompare(b.name) }
    )

    const customExercises = useMemo(
        () =>
            data.map((row): any => ({
                ...row,
                // Namespaced so a custom exercise can never collide with a
                // bundled repository id.
                id: `custom:${row.id}`,
                isCustom: true,
            })),
        [data]
    )

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

    return { customExercises, loading, offline, retry, addCustomExercise }
}
