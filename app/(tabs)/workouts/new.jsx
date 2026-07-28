import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native'
import { useRouter } from 'expo-router'
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedTextInput from '../../../components/ThemedTextInput'
import ThemedButton from '../../../components/ThemedButton'
import ThemedCard from '../../../components/ThemedCard'
import Spacer from '../../../components/Spacer'
import ExercisePicker from '../../../components/ExercisePicker'
import { Colors } from '../../../constants/Colors'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'
import { useWorkouts } from '../../../hooks/useWorkouts'
import { fieldsForType } from '../../../utils/exerciseSearch'
import { buildExerciseHistory, prefillSetsFor, previousSetSummary } from '../../../utils/exerciseHistory'

// Each set carries only the fields its exercise uses; the rest stay null so
// "not measured" stays distinct from "zero".
const FIELD_LABELS = {
    reps: 'Reps',
    weightKg: 'Weight (kg)',
    durationSeconds: 'Seconds',
    distanceMeters: 'Metres',
}

const emptySetFor = (type) =>
    fieldsForType(type).reduce((acc, field) => ({ ...acc, [field]: '' }), {})

const LogWorkout = () => {
    const { profile } = useAuth()
    const router = useRouter()
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const { workouts } = useWorkouts(profile?.uid)
    const history = useMemo(() => buildExerciseHistory(workouts), [workouts])

    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [durationMinutes, setDurationMinutes] = useState('')
    const [notes, setNotes] = useState('')
    const [exercises, setExercises] = useState([])
    const [pickerOpen, setPickerOpen] = useState(false)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const handlePickExercise = (exercise) => {
        setPickerOpen(false)
        const prefilled = prefillSetsFor(exercise, history).map((set) =>
            fieldsForType(exercise.type).reduce(
                (acc, field) => ({ ...acc, [field]: set[field] != null ? String(set[field]) : '' }),
                {}
            )
        )
        setExercises((prev) => [
            ...prev,
            {
                exerciseId: exercise.id,
                name: exercise.name,
                type: exercise.type,
                sets: prefilled.length ? prefilled : [emptySetFor(exercise.type)],
                previous: previousSetSummary(exercise, history),
            },
        ])
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

    const removeExercise = (exIndex) => setExercises((prev) => prev.filter((_, i) => i !== exIndex))
    const addSet = (exIndex) =>
        setExercises((prev) =>
            prev.map((ex, i) => (i === exIndex ? { ...ex, sets: [...ex.sets, emptySetFor(ex.type)] } : ex))
        )
    const removeSet = (exIndex, setIndex) =>
        setExercises((prev) =>
            prev.map((ex, i) => (i === exIndex ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) } : ex))
        )

    const handleSave = async () => {
        setError('')

        const cleanedExercises = exercises
            .map((ex) => ({
                exerciseId: ex.exerciseId,
                name: ex.name,
                type: ex.type,
                sets: ex.sets
                    // A set counts as logged if any of its fields has a value - a 45s
                    // plank and a bodyweight pushup are both valid without a weight.
                    .map((set) =>
                        fieldsForType(ex.type).reduce((acc, field) => {
                            const raw = String(set[field] ?? '').trim()
                            const parsed = Number(raw)
                            acc[field] = raw !== '' && Number.isFinite(parsed) ? parsed : null
                            return acc
                        }, {})
                    )
                    .filter((set) => Object.values(set).some((v) => v != null)),
            }))
            .filter((ex) => ex.sets.length > 0)

        if (cleanedExercises.length === 0) {
            setError('Add at least one exercise with a completed set.')
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
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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

                {exercises.length === 0 ? (
                    <>
                        <Spacer height={8} />
                        <ThemedText style={styles.hint}>
                            Add an exercise from the library to start logging.
                        </ThemedText>
                    </>
                ) : null}

                {exercises.map((exercise, exIndex) => {
                    const fields = fieldsForType(exercise.type)
                    return (
                        <View key={`${exercise.exerciseId}-${exIndex}`}>
                            <Spacer height={12} />
                            <ThemedCard>
                                <View style={styles.exerciseHeaderRow}>
                                    <View style={styles.exerciseNameWrap}>
                                        <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
                                        {exercise.previous ? (
                                            <ThemedText style={styles.previousHint}>{exercise.previous}</ThemedText>
                                        ) : null}
                                    </View>
                                    <Pressable onPress={() => removeExercise(exIndex)} style={styles.removeExerciseBtn}>
                                        <ThemedText style={{ color: Colors.warning }}>Remove</ThemedText>
                                    </Pressable>
                                </View>

                                <Spacer height={10} />
                                <View style={styles.setRow}>
                                    <ThemedText style={styles.setLabel} />
                                    {fields.map((field) => (
                                        <ThemedText key={field} style={[styles.columnLabel, { color: theme.iconColor }]}>
                                            {FIELD_LABELS[field]}
                                        </ThemedText>
                                    ))}
                                    <View style={styles.removeSetSpacer} />
                                </View>

                                {exercise.sets.map((set, setIndex) => (
                                    <View key={setIndex} style={styles.setRow}>
                                        <ThemedText style={styles.setLabel}>#{setIndex + 1}</ThemedText>
                                        {fields.map((field) => (
                                            <ThemedTextInput
                                                key={field}
                                                value={set[field] ?? ''}
                                                onChangeText={(text) => updateSet(exIndex, setIndex, field, text)}
                                                placeholder={FIELD_LABELS[field]}
                                                keyboardType="numeric"
                                                style={styles.setInput}
                                                editable={!saving}
                                            />
                                        ))}
                                        {exercise.sets.length > 1 ? (
                                            <Pressable
                                                onPress={() => removeSet(exIndex, setIndex)}
                                                style={styles.removeSetBtn}
                                            >
                                                <ThemedText style={{ color: Colors.warning }}>✕</ThemedText>
                                            </Pressable>
                                        ) : (
                                            <View style={styles.removeSetSpacer} />
                                        )}
                                    </View>
                                ))}

                                <Spacer height={6} />
                                <Pressable onPress={() => addSet(exIndex)}>
                                    <ThemedText style={styles.addLink}>+ Add Set</ThemedText>
                                </Pressable>
                            </ThemedCard>
                        </View>
                    )
                })}

                <Spacer height={12} />
                <Pressable onPress={() => setPickerOpen(true)} disabled={saving}>
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

            <ExercisePicker
                visible={pickerOpen}
                onSelect={handlePickExercise}
                onClose={() => setPickerOpen(false)}
            />
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
    hint: {
        fontSize: 13,
        opacity: 0.7,
    },
    exerciseHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    exerciseNameWrap: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    previousHint: {
        fontSize: 12,
        opacity: 0.7,
        marginTop: 2,
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
    columnLabel: {
        flex: 1,
        fontSize: 11,
    },
    setInput: {
        flex: 1,
    },
    removeSetBtn: {
        paddingHorizontal: 6,
    },
    removeSetSpacer: {
        width: 24,
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
