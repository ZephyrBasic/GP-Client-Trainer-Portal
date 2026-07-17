import { StyleSheet } from 'react-native'
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import Spacer from '../../components/Spacer'

const Workouts = () => (
    <ThemedView style={styles.container}>
        <ThemedText title={true} style={styles.title}>
            Workouts
        </ThemedText>
        <Spacer height={10} />
        <ThemedText>Workout logging and history are coming soon.</ThemedText>
    </ThemedView>
)

export default Workouts

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
