import { StyleSheet } from 'react-native'
import { doc } from 'firebase/firestore'

import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedCard from '../../components/ThemedCard'
import ThemedButton from '../../components/ThemedButton'
import OfflineBanner from '../../components/OfflineBanner'
import Spacer from '../../components/Spacer'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestoreDoc } from '../../hooks/useFirestoreSnapshot'
import { useOffline } from '../../hooks/useOffline'

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
                <ThemedText>
                    {authOffline
                        ? "Can't reach the server, so we couldn't load your profile. Check your connection - this screen will fill in on its own once you're back."
                        : "We couldn't load your profile. Try signing out and back in."}
                </ThemedText>
                {!authOffline && (
                    <>
                        <Spacer height={20} />
                        <ThemedButton onPress={signOut}>
                            <ThemedText style={styles.btnText}>Sign Out</ThemedText>
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

            <ThemedCard>
                <ThemedText title={true} style={styles.name}>
                    {profile.name}
                </ThemedText>
                <ThemedText>{profile.email}</ThemedText>
                <Spacer height={8} />
                <ThemedText style={styles.roleBadge}>{profile.role === 'trainer' ? 'Trainer' : 'Client'}</ThemedText>
            </ThemedCard>

            <Spacer height={16} />

            {profile.role === 'trainer' ? (
                <ThemedCard>
                    <ThemedText style={styles.label}>Your invite code</ThemedText>
                    <Spacer height={4} />
                    <ThemedText title={true} style={styles.inviteCode}>
                        {profile.inviteCode}
                    </ThemedText>
                    <Spacer height={8} />
                    <ThemedText>Share this with clients so they can link to you when they register.</ThemedText>
                </ThemedCard>
            ) : (
                <ThemedCard>
                    <ThemedText style={styles.label}>Your trainer</ThemedText>
                    <Spacer height={4} />
                    <ThemedText>{trainerLabel}</ThemedText>
                </ThemedCard>
            )}

            <Spacer height={24} />
            <ThemedButton onPress={signOut}>
                <ThemedText style={styles.btnText}>Sign Out</ThemedText>
            </ThemedButton>
        </ThemedView>
    )
}

export default Profile

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    roleBadge: {
        fontWeight: 'bold',
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 1,
    },
    label: {
        fontSize: 13,
        opacity: 0.8,
    },
    inviteCode: {
        fontSize: 24,
        letterSpacing: 2,
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
