import { useEffect, useState } from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { Redirect } from 'expo-router'
import { collection, onSnapshot, query, where } from 'firebase/firestore'

import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedCard from '../../components/ThemedCard'
import Spacer from '../../components/Spacer'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const ClientsRoster = () => {
    const { profile } = useAuth()
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (profile?.role !== 'trainer') return

        const clientsQuery = query(
            collection(db, 'users'),
            where('trainerId', '==', profile.uid),
            where('role', '==', 'client')
        )
        const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
            setClients(snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() })))
            setLoading(false)
        })
        return unsubscribe
    }, [profile?.uid, profile?.role])

    if (profile && profile.role !== 'trainer') {
        return <Redirect href="/" />
    }

    return (
        <ThemedView style={styles.container}>
            <ThemedText title={true} style={styles.title}>
                Your Clients
            </ThemedText>
            <Spacer height={16} />

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
                        <ThemedCard>
                            <ThemedText title={true} style={styles.clientName}>
                                {item.name}
                            </ThemedText>
                            <ThemedText>{item.email}</ThemedText>
                        </ThemedCard>
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
