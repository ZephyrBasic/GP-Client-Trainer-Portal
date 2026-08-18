import { FlatList, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedButton from '../../../components/ThemedButton'
import WorkoutSummaryCard from '../../../components/WorkoutSummaryCard'
import WorkoutListItem from '../../../components/WorkoutListItem'
import OfflineBanner from '../../../components/OfflineBanner'
import Spacer from '../../../components/Spacer'
import { useAuth } from '../../../contexts/AuthContext'
import { useWorkouts } from '../../../hooks/useWorkouts'
import { useOffline } from '../../../hooks/useOffline'
import { computeWorkoutStats } from '../../../utils/workoutStats'

const WorkoutsHistory = () => {
    const { profile } = useAuth()
    const router = useRouter()
    const { workouts, loading, offline: workoutsOffline, retry } = useWorkouts(profile?.uid)
    const offline = useOffline(workoutsOffline)
    const stats = computeWorkoutStats(workouts)

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={workouts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        <OfflineBanner visible={offline} onRetry={retry} />
                        <ThemedButton onPress={() => router.push('/workouts/new')}>
                            <ThemedText style={styles.btnText}>+ Log Workout</ThemedText>
                        </ThemedButton>
                        <Spacer height={16} />
                        <WorkoutSummaryCard stats={stats} />
                        <Spacer height={16} />
                        {!loading && workouts.length > 0 && (
                            <ThemedText style={styles.historyLabel}>History</ThemedText>
                        )}
                    </>
                }
                ItemSeparatorComponent={() => <Spacer height={10} />}
                ListEmptyComponent={
                    loading ? (
                        <ThemedText style={styles.empty}>Loading...</ThemedText>
                    ) : (
                        <ThemedText style={styles.empty}>
                            No workouts logged yet. Tap "Log Workout" to add your first session.
                        </ThemedText>
                    )
                }
                renderItem={({ item }) => (
                    <WorkoutListItem workout={item} onPress={() => router.push(`/workouts/${item.id}`)} />
                )}
            />
        </ThemedView>
    )
}

export default WorkoutsHistory

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    listContent: {
        paddingBottom: 20,
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    historyLabel: {
        fontSize: 13,
        opacity: 0.8,
        marginBottom: 4,
    },
    empty: {
        marginTop: 10,
    },
})
