import { StyleSheet } from 'react-native'
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import Spacer from '../../components/Spacer'
import { useAuth } from '../../contexts/AuthContext'

const Messages = () => {
    const { profile } = useAuth()
    const otherParty = profile?.role === 'trainer' ? 'clients' : 'trainer'

    return (
        <ThemedView style={styles.container}>
            <ThemedText title={true} style={styles.title}>
                Messages
            </ThemedText>
            <Spacer height={10} />
            <ThemedText>Chat with your {otherParty} is coming soon.</ThemedText>
        </ThemedView>
    )
}

export default Messages

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
})
