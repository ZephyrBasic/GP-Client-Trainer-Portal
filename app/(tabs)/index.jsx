import { StyleSheet } from 'react-native'
import { Redirect } from 'expo-router'

import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedCard from '../../components/ThemedCard'
import ThemedButton from '../../components/ThemedButton'
import Spacer from '../../components/Spacer'
import { useAuth } from '../../contexts/AuthContext'

const Home = () => {
    const { profile, signOut } = useAuth()

    if (!profile) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>We couldn't load your profile. Try signing out and back in.</ThemedText>
                <Spacer height={20} />
                <ThemedButton onPress={signOut}>
                    <ThemedText style={styles.btnText}>Sign Out</ThemedText>
                </ThemedButton>
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
