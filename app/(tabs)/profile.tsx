import { StyleSheet } from 'react-native'
import { doc } from 'firebase/firestore'

import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedCard from '../../components/ThemedCard'
import ThemedButton from '../../components/ThemedButton'
import ThemedChip from '../../components/ThemedChip'
import OfflineBanner from '../../components/OfflineBanner'
import Spacer from '../../components/Spacer'
import { Space } from '../../constants/Layout'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestoreDoc } from '../../hooks/useFirestoreSnapshot'
import { useOffline } from '../../hooks/useOffline'

/**
 * Me - identity, and the one fact each role needs about the other side of
 * the relationship: a Trainer's invite code, or a Client's trainer.
 */
const Profile = () => {
    const { profile, offline: authOffline, signOut } = useAuth()

    const {
        data: trainer,
        loading: trainerLoading,
        offline: trainerOffline,
        retry,
    } = useFirestoreDoc(
        () =>
            profile?.role === 'client' && profile?.trainerId ? doc(db, 'users', profile.trainerId) : null,
        [profile?.role, profile?.trainerId]
    )
    const offline = useOffline(trainerOffline)

    // This read used to have no error callback and no timeout, so an
    // unreachable backend left "Loading..." under "Your trainer" permanently.
    // It now resolves to a stated unknown instead of an eternal one.
    const trainerLabel = trainerLoading
        ? 'Loading...'
        : trainer?.name ?? (offline ? 'Unavailable offline' : 'Unknown')

    if (!profile) {
        // Same reasoning as app/(tabs)/index.tsx: don't tell someone who is
        // offline to sign out, because they won't be able to sign back in.
        return (
            <ThemedView style={styles.container}>
                <ThemedText variant="body" tone="body">
                    {authOffline
                        ? "Can't reach the server, so we couldn't load your profile. Check your connection - this screen will fill in on its own once you're back."
                        : "We couldn't load your profile. Try signing out and back in."}
                </ThemedText>
                {!authOffline && (
                    <>
                        <Spacer height={Space.xl} />
                        <ThemedButton onPress={signOut}>
                            <ThemedText variant="cardTitle" tone="onPrimary">
                                Sign Out
                            </ThemedText>
                        </ThemedButton>
                    </>
                )}
            </ThemedView>
        )
    }

    return (
        <ThemedView style={styles.container}>
            {/* useOffline folds in the auth-level flag, which matters on its own
                here: a trainer has no trainer doc to fetch, so the listener above
                never reports anything, and the stale thing on screen would be
                their own profile. */}
            <OfflineBanner visible={offline} onRetry={retry} />

            <ThemedCard raised={true}>
                <ThemedText variant="title" tone="title">
                    {profile.name}
                </ThemedText>
                <Spacer height={Space.xs} />
                <ThemedText variant="body" tone="muted">
                    {profile.email}
                </ThemedText>
                <Spacer height={Space.sm} />
                <ThemedChip label={profile.role === 'trainer' ? 'Trainer' : 'Client'} tone="muted" />
            </ThemedCard>

            <Spacer height={Space.lg} />

            {profile.role === 'trainer' ? (
                <ThemedCard>
                    <ThemedText variant="label" tone="muted">
                        Your invite code
                    </ThemedText>
                    <Spacer height={Space.xs} />
                    <ThemedText variant="title" tone="title" style={styles.inviteCode}>
                        {profile.inviteCode}
                    </ThemedText>
                    <Spacer height={Space.sm} />
                    <ThemedText variant="body" tone="muted">
                        Share this with clients so they can link to you when they register.
                    </ThemedText>
                </ThemedCard>
            ) : (
                <ThemedCard>
                    <ThemedText variant="label" tone="muted">
                        Your trainer
                    </ThemedText>
                    <Spacer height={Space.xs} />
                    <ThemedText variant="body" tone="title">
                        {trainerLabel}
                    </ThemedText>
                </ThemedCard>
            )}

            <Spacer height={Space.xxl} />
            <ThemedButton onPress={signOut}>
                <ThemedText variant="cardTitle" tone="onPrimary">
                    Sign Out
                </ThemedText>
            </ThemedButton>
        </ThemedView>
    )
}

export default Profile

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: Space.xl,
    },
    inviteCode: {
        letterSpacing: 2,
    },
})
