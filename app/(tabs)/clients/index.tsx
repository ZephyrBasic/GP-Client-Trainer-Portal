import { FlatList, Pressable, StyleSheet } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { collection, query, where } from 'firebase/firestore'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedCard from '../../../components/ThemedCard'
import OfflineBanner from '../../../components/OfflineBanner'
import Spacer from '../../../components/Spacer'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'
import { useFirestoreQuery } from '../../../hooks/useFirestoreSnapshot'
import { useOffline } from '../../../hooks/useOffline'

const ClientsRoster = () => {
    const { profile } = useAuth()
    const router = useRouter()

    const { data: clients, loading, offline: clientsOffline, retry } = useFirestoreQuery(
        () =>
            profile?.role === 'trainer'
                ? query(
                      collection(db, 'users'),
                      where('trainerId', '==', profile.uid),
                      where('role', '==', 'client')
                  )
                : null,
        [profile?.uid, profile?.role],
        { idKey: 'uid' }
    )
    const offline = useOffline(clientsOffline)

    if (profile && profile.role !== 'trainer') {
        return <Redirect href="/" />
    }

    return (
        <ThemedView style={styles.container}>
            <ThemedText title={true} style={styles.title}>
                Your Clients
            </ThemedText>
            <Spacer height={16} />

            <OfflineBanner visible={offline} onRetry={retry} />

            {loading ? (
                <ThemedText>Loading...</ThemedText>
            ) : clients.length === 0 ? (
                <ThemedText>
                    No clients yet. Share your invite code (see Profile tab) so clients can link to you when they
                    register.
                </ThemedText>
            ) : (
                <FlatList
                    data={clients}
                    keyExtractor={(item) => item.uid}
                    ItemSeparatorComponent={() => <Spacer height={10} />}
                    renderItem={({ item }) => (
                        <Pressable onPress={() => router.push(`/clients/${item.uid}`)}>
                            <ThemedCard>
                                <ThemedText title={true} style={styles.clientName}>
                                    {item.name}
                                </ThemedText>
                                <ThemedText>{item.email}</ThemedText>
                            </ThemedCard>
                        </Pressable>
                    )}
                />
            )}
        </ThemedView>
    )
}

export default ClientsRoster

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    clientName: {
        fontSize: 16,
        marginBottom: 4,
    },
})
