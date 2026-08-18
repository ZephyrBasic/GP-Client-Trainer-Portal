import { StyleSheet } from 'react-native'
import { Redirect } from 'expo-router'

import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedCard from '../../components/ThemedCard'
import ThemedButton from '../../components/ThemedButton'
import Spacer from '../../components/Spacer'
import { useAuth } from '../../contexts/AuthContext'

const Home = () => {
    const { profile, offline, signOut } = useAuth()

    if (!profile) {
        // Reaching this screen with no profile used to mean one thing; now that
        // the auth gate times out rather than spinning forever, it also means
        // "we never heard back". Telling an offline client to sign out and back
        // in is the worst possible advice - signing out is the one action they
        // cannot undo without a connection - so the two cases must read
        // differently, and the offline one must not offer the button.
        return (
            <ThemedView style={styles.container}>
                <ThemedText>
                    {offline
                        ? "Can't reach the server, so we couldn't load your profile. Check your connection - this screen will fill in on its own once you're back."
                        : "We couldn't load your profile. Try signing out and back in."}
                </ThemedText>
                {!offline && (
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

    if (profile.role === 'trainer') {
        return <Redirect href="/clients" />
    }

    return (
        <ThemedView style={styles.container}>
            <ThemedText title={true} style={styles.title}>
                Welcome back, {profile.name}
            </ThemedText>
            <Spacer height={20} />
            <ThemedCard>
                <ThemedText>Your workout summary will show up here once you log your first session.</ThemedText>
            </ThemedCard>
        </ThemedView>
    )
}

export default Home

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
