import { useState } from 'react'
import { Platform, ScrollView, StyleSheet } from 'react-native'
import { doc } from 'firebase/firestore'
import Constants from 'expo-constants'

import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedCard from '../../components/ThemedCard'
import ThemedButton from '../../components/ThemedButton'
import ThemedChip from '../../components/ThemedChip'
import DeleteAccountSheet from '../../components/DeleteAccountSheet'
import ExternalLink from '../../components/ExternalLink'
import LegalLinks from '../../components/LegalLinks'
import OfflineBanner from '../../components/OfflineBanner'
import { PlaceholderInline } from '../../components/Placeholder'
import SectionLabel from '../../components/SectionLabel'
import Spacer from '../../components/Spacer'
import { Space } from '../../constants/Layout'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useClients } from '../../hooks/useClients'
import { useFirestoreDoc } from '../../hooks/useFirestoreSnapshot'
import { useOffline } from '../../hooks/useOffline'
import { getAuthErrorMessage } from '../../utils/firebaseErrors'
import { buildFeedbackMailto } from '../../utils/links'

/**
 * Me - identity, and the one fact each role needs about the other side of
 * the relationship: a Trainer's invite code, or a Client's trainer.
 *
 * Also, since there is nowhere else for them, every account action the beta
 * needs: verification state, a way to tell us something is broken, the legal
 * documents, sign out, and deletion.
 */
const Profile = () => {
    const {
        user,
        profile,
        offline: authOffline,
        emailVerified,
        signOut,
        sendVerificationEmail,
        refreshVerification,
        deleteAccount,
    } = useAuth()

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

    // Only a Trainer's roster, and only to count it: deleting a Trainer out from
    // under their Clients is the one deletion utils/deleteAccount refuses, and
    // this is the number that decides. A Client subscribes to nothing here.
    const {
        clients,
        loading: clientsLoading,
        offline: clientsOffline,
        error: clientsError,
    } = useClients(profile?.role === 'trainer' ? profile.uid : null)
    // An empty roster and an unknown one look identical in `clients`, and only
    // the first may unblock a Trainer's deletion - so the other three states are
    // passed as null. deleteOwnAccount re-counts from the server regardless.
    const clientCount =
        profile?.role === 'trainer' && (clientsLoading || clientsOffline || clientsError)
            ? null
            : clients.length

    const [deleting, setDeleting] = useState(false)
    const [verifyNote, setVerifyNote] = useState('')

    // This read used to have no error callback and no timeout, so an
    // unreachable backend left "Loading..." under "Your trainer" permanently.
    // It now resolves to a stated unknown instead of an eternal one.
    const trainerLabel = trainer?.name ?? (offline ? 'Unavailable offline' : 'Unknown')

    const feedbackHref = buildFeedbackMailto({
        role: profile?.role,
        platform: Platform.OS,
        version: Constants.expoConfig?.version,
    })

    const handleResend = async () => {
        setVerifyNote('')
        try {
            await sendVerificationEmail()
            setVerifyNote('Sent. Check your inbox, and your spam folder.')
        } catch (err) {
            setVerifyNote(getAuthErrorMessage(err))
        }
    }

    const handleRefreshVerification = async () => {
        setVerifyNote('')
        try {
            const verified = await refreshVerification()
            if (!verified) setVerifyNote("Still not verified - open the link in the email first.")
        } catch (err) {
            setVerifyNote(getAuthErrorMessage(err))
        }
    }

    if (!profile) {
        // Same reasoning as app/(tabs)/index.tsx: don't tell someone who is
        // offline to sign out, because they won't be able to sign back in.
        return (
            <ThemedView style={[styles.screen, styles.fallback]}>
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
                                Sign out
                            </ThemedText>
                        </ThemedButton>
                    </>
                )}
            </ThemedView>
        )
    }

    return (
        <ThemedView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.container}>
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

                {/* Verification is shown, never enforced - see the note on
                    `emailVerified` in AuthContext. An unverified tester keeps
                    working; they are just told, here, where the resend button
                    also is. The card disappears entirely once verified rather
                    than turning into a green tick nobody needs. */}
                {user && !emailVerified ? (
                    <>
                        <Spacer height={Space.lg} />
                        <ThemedCard muted={true}>
                            <SectionLabel>Email not verified</SectionLabel>
                            <Spacer height={Space.xs} />
                            <ThemedText variant="body" tone="body">
                                We sent a link to {profile.email} when you registered. Verifying makes
                                sure a password reset can actually reach you.
                            </ThemedText>
                            {verifyNote ? (
                                <>
                                    <Spacer height={Space.sm} />
                                    <ThemedText variant="small" tone="muted">
                                        {verifyNote}
                                    </ThemedText>
                                </>
                            ) : null}
                            <Spacer height={Space.md} />
                            <ThemedButton variant="ghost" onPress={handleResend}>
                                <ThemedText variant="cardTitle" tone="body">
                                    Resend the email
                                </ThemedText>
                            </ThemedButton>
                            <Spacer height={Space.sm} />
                            <ThemedButton variant="ghost" onPress={handleRefreshVerification}>
                                <ThemedText variant="cardTitle" tone="body">
                                    I've verified - check again
                                </ThemedText>
                            </ThemedButton>
                        </ThemedCard>
                    </>
                ) : null}

                <Spacer height={Space.lg} />

                {profile.role === 'trainer' ? (
                    <ThemedCard>
                        <SectionLabel>Your invite code</SectionLabel>
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
                        <SectionLabel>Your trainer</SectionLabel>
                        <Spacer height={Space.xs} />
                        {trainerLoading ? (
                            <PlaceholderInline width={120} />
                        ) : (
                            <ThemedText variant="body" tone="title">
                                {trainerLabel}
                            </ThemedText>
                        )}
                    </ThemedCard>
                )}

                <Spacer height={Space.xl} />
                <SectionLabel>Help and legal</SectionLabel>
                <ExternalLink href={feedbackHref} label="Send feedback or report a problem" />
                <LegalLinks style={styles.legal} />

                {/* Outlined, not filled: it was the heaviest thing on the
                    screen, for the action least wanted by mistake. */}
                <Spacer height={Space.xl} />
                <ThemedButton variant="ghost" onPress={signOut}>
                    <ThemedText variant="cardTitle" tone="body">
                        Sign out
                    </ThemedText>
                </ThemedButton>

                {/* Last on the screen and drawn as an outline, not a fill. The
                    whole tab has one filled button and this is not it. */}
                <Spacer height={Space.lg} />
                <ThemedButton variant="danger" onPress={() => setDeleting(true)}>
                    <ThemedText variant="cardTitle" tone="danger">
                        Delete my account
                    </ThemedText>
                </ThemedButton>

                <Spacer height={Space.sm} />
                <ThemedText variant="small" tone="faint" style={styles.version}>
                    {`Version ${Constants.expoConfig?.version ?? 'unknown'}`}
                </ThemedText>
            </ScrollView>

            <DeleteAccountSheet
                visible={deleting}
                onClose={() => setDeleting(false)}
                role={profile.role}
                clientCount={clientCount}
                onConfirm={deleteAccount}
            />
        </ThemedView>
    )
}

export default Profile

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    container: {
        flexGrow: 1,
        padding: Space.xl,
    },
    fallback: {
        padding: Space.xl,
    },
    inviteCode: {
        letterSpacing: 2,
    },
    legal: {
        // Left-aligned with the rest of this section rather than centred like
        // the signup screen's copy, where it sits under a centred form.
        justifyContent: 'flex-start',
    },
    version: {
        textAlign: 'center',
    },
})
