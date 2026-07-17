import { StyleSheet } from 'react-native'
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import Spacer from '../../components/Spacer'

const Progress = () => (
    <ThemedView style={styles.container}>
        <ThemedText title={true} style={styles.title}>
            Progress
        </ThemedText>
        <Spacer height={10} />
        <ThemedText>Progress video uploads are coming soon.</ThemedText>
    </ThemedView>
)

export default Progress

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
