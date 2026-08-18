import { useAuth } from '../contexts/AuthContext'

// Combines a screen's own offline flags with the auth-level one.
//
// This exists because of a failure that only appears once the timeouts work.
// Nearly every read keys off `profile.uid`. When the profile listener is the
// thing that timed out, `profile` is null, so the screen hands its hook a null
// id - and the hook correctly reports "no id, nothing to subscribe to, not
// offline". The result is a confident, wrong empty state: "No workouts logged
// yet" to a client who has five, with no banner, because every individual
// component behaved correctly.
//
// So "am I offline?" cannot be answered by the leaf hook alone. It has to
// include whether the profile that the leaf's id came from ever arrived.
//
// Lives in its own file rather than in useFirestoreSnapshot to avoid a cycle:
// AuthContext imports SNAPSHOT_TIMEOUT_MS from there.
export const useOffline = (...flags: boolean[]) => {
    const { offline: authOffline } = useAuth()
    return authOffline || flags.some(Boolean)
}
