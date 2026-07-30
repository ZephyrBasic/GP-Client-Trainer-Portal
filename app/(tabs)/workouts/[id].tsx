import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { deleteDoc, doc, onSnapshot } from 'firebase/firestore'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedCard from '../../../components/ThemedCard'
import ThemedButton from '../../../components/ThemedButton'
import Spacer from '../../../components/Spacer'
import { Colors } from '../../../constants/Colors'
import { db } from '../../../firebase/config'
import { volumeForWorkout } from '../../../utils/workoutStats'
import { formatSet } from '../../../utils/formatSet'

const WorkoutDetail = () => {
    const { id } = useLocalSearchParams<{ id: string }>()
    const router = useRouter()
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const [workout, setWorkout] = useState(null)
    const [loading, setLoading] = useState(true)
    const [accessDenied, setAccessDenied] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (!id) return
        const unsubscribe = onSnapshot(
            doc(db, 'workouts', id),
            (snapshot) => {
                setWorkout(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
                setLoading(false)
            },
            () => {
                setAccessDenied(true)
                setLoading(false)
            }
        )
        return unsubscribe
    }, [id])

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await deleteDoc(doc(db, 'workouts', id))
            router.back()
        } catch (err) {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Loading...</ThemedText>
            </ThemedView>
        )
    }

    if (accessDenied || !workout) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>This workout isn't available.</ThemedText>
            </ThemedView>
        )
    }

    const dateLabel = workout.date?.toDate ? workout.date.toDate().toLocaleDateString() : 'Unknown date'
    const volume = volumeForWorkout(workout)

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <ThemedText title={true} style={styles.date}>
                    {dateLabel}
                </ThemedText>
                <ThemedText style={styles.meta}>
                    {workout.durationMinutes ?? 0} min · Volume {Math.round(volume).toLocaleString()}
                </ThemedText>

                <Spacer height={16} />
                {(workout.exercises ?? []).map((exercise, index) => (
                    <View key={index}>
                        <Spacer height={index === 0 ? 0 : 12} />
                        <ThemedCard>
                            <ThemedText title={true} style={styles.exerciseName}>
                                {exercise.name}
                            </ThemedText>
                            <Spacer height={8} />
                            {(exercise.sets ?? []).map((set, setIndex) => (
                                <ThemedText key={setIndex} style={styles.setLine}>
                                    Set {setIndex + 1}: {formatSet(set)}
                                </ThemedText>
                            ))}
                        </ThemedCard>
                    </View>
                ))}

                {workout.notes ? (
                    <>
                        <Spacer height={16} />
                        <ThemedCard>
                            <ThemedText style={styles.label}>Notes</ThemedText>
                            <Spacer height={4} />
                            <ThemedText>{workout.notes}</ThemedText>
                        </ThemedCard>
                    </>
                ) : null}

                <Spacer height={24} />
                {!confirmingDelete ? (
                    <ThemedButton onPress={() => setConfirmingDelete(true)} style={{ backgroundColor: Colors.warning }}>
                        <ThemedText style={styles.deleteBtnText}>Delete Workout</ThemedText>
                    </ThemedButton>
                ) : (
                    <View>
                        <ThemedText>Delete this workout? This cannot be undone.</ThemedText>
                        <Spacer height={10} />
                        <View style={styles.confirmRow}>
                            <ThemedButton
                                onPress={() => setConfirmingDelete(false)}
                                style={[styles.confirmBtn, { backgroundColor: theme.uiBackground }]}
                                disabled={deleting}
                            >
                                <ThemedText>Cancel</ThemedText>
                            </ThemedButton>
                            <ThemedButton
                                onPress={handleDelete}
                                style={[styles.confirmBtn, { backgroundColor: Colors.warning }]}
                                disabled={deleting}
                            >
                                <ThemedText style={styles.deleteBtnText}>
                                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                                </ThemedText>
                            </ThemedButton>
                        </View>
                    </View>
                )}
            </ScrollView>
        </ThemedView>
    )
}

export default WorkoutDetail

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    date: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    meta: {
        marginTop: 4,
        opacity: 0.8,
    },
    exerciseName: {
        fontSize: 16,
    },
    setLine: {
        marginBottom: 2,
    },
    label: {
        fontSize: 13,
        opacity: 0.8,
    },
    confirmRow: {
        flexDirection: 'row',
        gap: 10,
    },
    confirmBtn: {
        flex: 1,
    },
    deleteBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
