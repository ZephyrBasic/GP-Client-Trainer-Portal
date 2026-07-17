import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedTextInput from '../../../components/ThemedTextInput'
import ThemedButton from '../../../components/ThemedButton'
import ThemedCard from '../../../components/ThemedCard'
import Spacer from '../../../components/Spacer'
import { Colors } from '../../../constants/Colors'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'

const emptySet = () => ({ reps: '', weight: '' })
const emptyExercise = () => ({ name: '', sets: [emptySet()] })

const LogWorkout = () => {
    const { profile } = useAuth()
    const router = useRouter()

    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [durationMinutes, setDurationMinutes] = useState('')
    const [notes, setNotes] = useState('')
    const [exercises, setExercises] = useState([emptyExercise()])
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const updateExerciseName = (exIndex, name) => {
        setExercises((prev) => prev.map((ex, i) => (i === exIndex ? { ...ex, name } : ex)))
    }

    const updateSet = (exIndex, setIndex, field, value) => {
        setExercises((prev) =>
            prev.map((ex, i) =>
                i === exIndex
                    ? { ...ex, sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, [field]: value } : s)) }
                    : ex
            )
        )
    }

    const addExercise = () => setExercises((prev) => [...prev, emptyExercise()])
    const removeExercise = (exIndex) => setExercises((prev) => prev.filter((_, i) => i !== exIndex))
    const addSet = (exIndex) =>
        setExercises((prev) => prev.map((ex, i) => (i === exIndex ? { ...ex, sets: [...ex.sets, emptySet()] } : ex)))
    const removeSet = (exIndex, setIndex) =>
        setExercises((prev) =>
            prev.map((ex, i) => (i === exIndex ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) } : ex))
        )

    const handleSave = async () => {
        setError('')

        const cleanedExercises = exercises
            .map((ex) => ({
                name: ex.name.trim(),
                sets: ex.sets
                    .map((s) => ({ reps: Number(s.reps), weight: Number(s.weight) || 0 }))
                    .filter((s) => Number.isFinite(s.reps) && s.reps > 0),
            }))
            .filter((ex) => ex.name && ex.sets.length > 0)

        if (cleanedExercises.length === 0) {
            setError('Add at least one exercise with a name and at least one set (reps greater than 0).')
            return
        }

        const parsedDate = new Date(date)
        if (Number.isNaN(parsedDate.getTime())) {
            setError('Enter a valid date (YYYY-MM-DD).')
            return
        }

        setSaving(true)
        try {
            await addDoc(collection(db, 'workouts'), {
                clientId: profile.uid,
                date: Timestamp.fromDate(parsedDate),
                exercises: cleanedExercises,
                durationMinutes: Number(durationMinutes) || 0,
                notes: notes.trim(),
                createdAt: serverTimestamp(),
            })
            router.back()
        } catch (err) {
            setError(err.message || 'Failed to save workout.')
            setSaving(false)
        }
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <ThemedText style={styles.label}>Date</ThemedText>
                <ThemedTextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" editable={!saving} />

                <Spacer height={16} />
                <ThemedText style={styles.label}>Duration (minutes)</ThemedText>
                <ThemedTextInput
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    keyboardType="numeric"
                    editable={!saving}
                />

                <Spacer height={20} />
                <ThemedText style={styles.sectionTitle}>Exercises</ThemedText>

                {exercises.map((exercise, exIndex) => (
                    <View key={exIndex}>
                        <Spacer height={12} />
                        <ThemedCard>
                            <View style={styles.exerciseHeaderRow}>
                                <View style={styles.exerciseNameInput}>
                                    <ThemedTextInput
                                        value={exercise.name}
                                        onChangeText={(text) => updateExerciseName(exIndex, text)}
                                        placeholder="Exercise name"
                                        editable={!saving}
                                    />
                                </View>
                                {exercises.length > 1 && (
                                    <Pressable onPress={() => removeExercise(exIndex)} style={styles.removeExerciseBtn}>
                                        <ThemedText style={{ color: Colors.warning }}>Remove</ThemedText>
                                    </Pressable>
                                )}
                            </View>

                            <Spacer height={10} />
                            {exercise.sets.map((set, setIndex) => (
                                <View key={setIndex} style={styles.setRow}>
                                    <ThemedText style={styles.setLabel}>#{setIndex + 1}</ThemedText>
                                    <ThemedTextInput
                                        value={set.reps}
                                        onChangeText={(text) => updateSet(exIndex, setIndex, 'reps', text)}
                                        placeholder="Reps"
                                        keyboardType="numeric"
                                        style={styles.setInput}
                                        editable={!saving}
                                    />
                                    <ThemedTextInput
                                        value={set.weight}
                                        onChangeText={(text) => updateSet(exIndex, setIndex, 'weight', text)}
                                        placeholder="Weight"
                                        keyboardType="numeric"
                                        style={styles.setInput}
                                        editable={!saving}
                                    />
                                    {exercise.sets.length > 1 && (
                                        <Pressable onPress={() => removeSet(exIndex, setIndex)} style={styles.removeSetBtn}>
                                            <ThemedText style={{ color: Colors.warning }}>✕</ThemedText>
                                        </Pressable>
                                    )}
                                </View>
                            ))}

                            <Spacer height={6} />
                            <Pressable onPress={() => addSet(exIndex)}>
                                <ThemedText style={styles.addLink}>+ Add Set</ThemedText>
                            </Pressable>
                        </ThemedCard>
                    </View>
                ))}

                <Spacer height={12} />
                <Pressable onPress={addExercise}>
                    <ThemedText style={styles.addLink}>+ Add Exercise</ThemedText>
                </Pressable>

                <Spacer height={20} />
                <ThemedText style={styles.label}>Notes</ThemedText>
                <ThemedTextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="How did it feel?"
                    multiline
                    numberOfLines={3}
                    style={styles.notesInput}
                    editable={!saving}
                />

                {error ? (
                    <>
                        <Spacer height={16} />
                        <ThemedText style={{ color: Colors.warning }}>{error}</ThemedText>
                    </>
                ) : null}

                <Spacer height={20} />
                <ThemedButton onPress={handleSave} disabled={saving}>
                    <ThemedText style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Workout'}</ThemedText>
                </ThemedButton>
                <Spacer height={20} />
            </ScrollView>
        </ThemedView>
    )
}

export default LogWorkout

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    label: {
        marginBottom: 6,
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    exerciseHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    exerciseNameInput: {
        flex: 1,
    },
    removeExerciseBtn: {
        marginLeft: 10,
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    setLabel: {
        width: 24,
        fontSize: 12,
        opacity: 0.7,
    },
    setInput: {
        flex: 1,
    },
    removeSetBtn: {
        paddingHorizontal: 6,
    },
    addLink: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    notesInput: {
        minHeight: 80,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
