import { useSegments } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'

// Returns the path to redirect to (or null if the current route is fine).
// Deliberately declarative rather than calling router.replace() in an
// effect: an imperative replace() can race the navigator's own mount/route
// transitions and log "action not handled by any navigator" warnings.
// Returning a target path lets the layout render <Redirect> instead.
export const useProtectedRoute = () => {
    const { user, loading, signingUp } = useAuth()
    const segments = useSegments()

    // A signup in flight has a signed-in user sitting on an auth screen, which
    // is exactly the state the rule below redirects away from. Redirecting would
    // unmount the register screen before it can show a failed code check - see
    // signUp in AuthContext.
    if (loading || signingUp) return null

    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup) return '/login'
    if (user && inAuthGroup) return '/'
    return null
}
