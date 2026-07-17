import { useEffect } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'

export const useProtectedRoute = () => {
    const { user, loading } = useAuth()
    const segments = useSegments()
    const router = useRouter()

    useEffect(() => {
        if (loading) return

        const inAuthGroup = segments[0] === '(auth)'

        if (!user && !inAuthGroup) {
            router.replace('/login')
        } else if (user && inAuthGroup) {
            router.replace('/')
        }
    }, [user, loading, segments])
}
