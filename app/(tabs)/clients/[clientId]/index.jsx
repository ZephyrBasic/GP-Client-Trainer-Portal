import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { doc, onSnapshot } from 'firebase/firestore'

import ThemedView from '../../../../components/ThemedView'
import ThemedText from '../../../../components/ThemedText'
import ThemedCard from '../../../../components/ThemedCard'
import ThemedButton from '../../../../components/ThemedButton'
import WorkoutSummaryCard from '../../../../components/WorkoutSummaryCard'
import Spacer from '../../../../components/Spacer'
import { db } from '../../../../firebase/config'
import { useWorkouts } from '../../../../hooks/useWorkouts'
import { computeWorkoutStats, volumeForWorkout } from '../../../../utils/workoutStats'
import { formatSet } from '../../../../utils/formatSet'

const ClientDetail = () => {
    const { clientId } = useLocalSearchParams()
    const router = useRouter()
    const [clientProfile, setClientProfile] = useState(null)
    const { workouts, loading } = useWorkouts(clientId)
    const stats = computeWorkoutStats(workouts)
    const [expandedId, setExpandedId] = useState(null)

    useEffect(() => {
        if (!clientId) return
        const unsubscribe = onSnapshot(doc(db, 'users', clientId), (snapshot) => {
            setClientProfile(snapshot.exists() ? snapshot.data() : null)
        })
        return unsubscribe
    }, [clientId])

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={workouts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        <ThemedText title={true} style={styles.title}>
                            {clientProfile?.name ?? 'Client'}
                        </ThemedText>
                        <Spacer height={16} />
                        <ThemedButton onPress={() => router.push(`/clients/${clientId}/progress`)}>
                            <ThemedText style={styles.progressBtnText}>View Progress Photos/Videos</ThemedText>
                        </ThemedButton>
                        <Spacer height={16} />
                        <WorkoutSummaryCard stats={stats} />
                        <Spacer height={16} />
                        {!loading && workouts.length > 0 && (
                            <ThemedText style={styles.historyLabel}>History (tap to expand)</ThemedText>
                        )}
                    </>
                }
                ItemSeparatorComponent={() => <Spacer height={10} />}
                ListEmptyComponent={
                    !loading && <ThemedText style={styles.empty}>This client hasn't logged any workouts yet.</ThemedText>
                }
                renderItem={({ item }) => {
                    const expanded = expandedId === item.id
                    const dateLabel = item.date?.toDate ? item.date.toDate().toLocaleDateString() : 'Unknown date'

                    return (
                        <Pressable onPress={() => setExpandedId(expanded ? null : item.id)}>
                            <ThemedCard>
                                <ThemedText title={true} style={styles.date}>
                                    {dateLabel}
                                </ThemedText>
                                <ThemedText>
                                    {(item.exercises?.length ?? 0)} exercises · {item.durationMinutes ?? 0} min
                                </ThemedText>
                                <ThemedText style={styles.volume}>
                                    Volume: {Math.round(volumeForWorkout(item)).toLocaleString()}
                                </ThemedText>

                                {expanded && (
                                    <View style={styles.expanded}>
                                        {(item.exercises ?? []).map((exercise, i) => (
                                            <View key={i} style={styles.exerciseBlock}>
                                                <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
                                                {(exercise.sets ?? []).map((set, j) => (
                                                    <ThemedText key={j}>
                                                        Set {j + 1}: {formatSet(set)}
                                                    </ThemedText>
                                                ))}
                                            </View>
                                        ))}
                                        {item.notes ? (
                                            <ThemedText style={styles.notes}>Notes: {item.notes}</ThemedText>
                                        ) : null}
                                    </View>
                                )}
                            </ThemedCard>
                        </Pressable>
                    )
                }}
            />
        </ThemedView>
    )
}

export default ClientDetail

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    listContent: {
        paddingBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    progressBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    historyLabel: {
        fontSize: 13,
        opacity: 0.8,
        marginBottom: 4,
    },
    empty: {
        marginTop: 10,
    },
    date: {
        fontSize: 15,
    },
    volume: {
        marginTop: 4,
        fontSize: 12,
        opacity: 0.8,
    },
    expanded: {
        marginTop: 10,
    },
    exerciseBlock: {
        marginBottom: 8,
    },
    exerciseName: {
        fontWeight: 'bold',
    },
    notes: {
        opacity: 0.8,
        marginTop: 4,
    },
})
