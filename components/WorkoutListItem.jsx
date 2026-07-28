import { Pressable, StyleSheet } from 'react-native'
import ThemedCard from './ThemedCard'
import ThemedText from './ThemedText'
import { volumeForWorkout } from '../utils/workoutStats'

const WorkoutListItem = ({ workout, onPress }) => {
    const volume = volumeForWorkout(workout)
    const exerciseCount = workout.exercises?.length ?? 0
    const dateLabel = workout.date?.toDate ? workout.date.toDate().toLocaleDateString() : 'Unknown date'

    return (
        <Pressable onPress={onPress}>
            <ThemedCard style={styles.card}>
                <ThemedText title={true} style={styles.date}>
                    {dateLabel}
                </ThemedText>
                <ThemedText>
                    {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'} · {workout.durationMinutes ?? 0} min
                </ThemedText>
                <ThemedText style={styles.volume}>Volume: {Math.round(volume).toLocaleString()}</ThemedText>
            </ThemedCard>
        </Pressable>
    )
}

export default WorkoutListItem

const styles = StyleSheet.create({
    card: {
        padding: 15,
    },
    date: {
        fontSize: 15,
        marginBottom: 4,
    },
    volume: {
        marginTop: 4,
        fontSize: 12,
        opacity: 0.8,
    },
})
