import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { doc, onSnapshot } from 'firebase/firestore'

import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedCard from '../../components/ThemedCard'
import ThemedButton from '../../components/ThemedButton'
import Spacer from '../../components/Spacer'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const Profile = () => {
    const { profile, signOut } = useAuth()
    const [trainerName, setTrainerName] = useState(null)

    useEffect(() => {
        if (profile?.role !== 'client' || !profile?.trainerId) return

        const unsubscribe = onSnapshot(doc(db, 'users', profile.trainerId), (snapshot) => {
            setTrainerName(snapshot.exists() ? snapshot.data().name : null)
        })
        return unsubscribe
    }, [profile?.role, profile?.trainerId])

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

    return (
        <ThemedView style={styles.container}>
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
                    <ThemedText>{trainerName ?? 'Loading...'}</ThemedText>
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
