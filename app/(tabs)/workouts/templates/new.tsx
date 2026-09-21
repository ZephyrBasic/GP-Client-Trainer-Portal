import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'

import ThemedView from '../../../../components/ThemedView'
import ThemedText from '../../../../components/ThemedText'
import ThemedTextInput from '../../../../components/ThemedTextInput'
import ThemedButton from '../../../../components/ThemedButton'
import Spacer from '../../../../components/Spacer'
import ScreenEnter from '../../../../components/ScreenEnter'
import SectionLabel from '../../../../components/SectionLabel'
import ExercisePicker from '../../../../components/ExercisePicker'
import ExerciseSetEditor from '../../../../components/ExerciseSetEditor'
import { Space, SCREEN_PADDING } from '../../../../constants/Layout'
import { FontFamily } from '../../../../constants/Type'
import { useAuth } from '../../../../contexts/AuthContext'
import { useExerciseDraft } from '../../../../hooks/useExerciseDraft'
import { useLeave } from '../../../../hooks/useLeave'
import { createWorkoutTemplate } from '../../../../hooks/useWorkoutTemplates'
import { storedSetFrom } from '../../../../utils/setDraft'

/**
 * Authoring a Workout Template: a name, Exercises from the shared catalog, and
 * the target Sets on each.
 *
 * Target Sets and performed Sets are the same thing on screen, so this renders
 * the same ExerciseSetEditor manual entry does. What differs is what a blank row
 * means - see handleSave.
 */
const NewWorkoutTemplate = () => {
    const { profile } = useAuth()
    // A Trainer writes these from the Library, a Client from Today - so a
    // Client's back and save always return to Today, which is where their own
    // workouts are listed.
    const { leave, fromToday } = useLeave({
        home: '/workouts/templates',
        homeLabel: 'Library',
        toToday: profile?.role !== 'trainer',
    })

    const [name, setName] = useState('')
    const [pickerOpen, setPickerOpen] = useState(false)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    // One empty row per Exercise, which is the hook's own default. Nothing is
    // prefilled from history here: a Template is what the author intends, not
    // what anyone last did.
    const { exercises, pickExercise, updateSet, addSet, removeSet, removeExercise } = useExerciseDraft()

    const handlePickExercise = (exercise) => {
        setPickerOpen(false)
        pickExercise(exercise)
    }

    const handleSave = async () => {
        setError('')

        const trimmedName = name.trim()
        if (!trimmedName) {
            setError('Give the template a name.')
            return
        }
        if (exercises.length === 0) {
            setError('Add at least one exercise.')
            return
        }

        const targetExercises = exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            fields: ex.fields,
            // Every row the author left stands, including one with nothing typed
            // into it: the number of target Sets is itself part of the plan, so
            // dropping a blank row would quietly prescribe less work. Manual
            // entry filters blank rows for the opposite reason - a performed Set
            // with no measurement never happened.
            //
            // storedSetFrom is the only place a measurement becomes a number, and
            // it stores a blank box as null rather than 0.
            sets: ex.sets.map((set) => storedSetFrom(set, ex.fields)),
        }))

        setSaving(true)
        try {
            await createWorkoutTemplate({
                authorId: profile.uid,
                name: trimmedName,
                exercises: targetExercises,
            })
            leave()
        } catch (err) {
            setError(err.message || 'Failed to save template.')
            setSaving(false)
        }
    }

    return (
        <ThemedView style={styles.container}>
            <ScreenEnter play={fromToday}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <ThemedText variant="meta" tone="muted" style={styles.label}>
                        Name
                    </ThemedText>
                    <ThemedTextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Upper Body A"
                        autoCapitalize="words"
                        editable={!saving}
                    />

                    <Spacer height={Space.xl} />
                    <SectionLabel>EXERCISES</SectionLabel>

                    {exercises.length === 0 ? (
                        <>
                            <Spacer height={Space.sm} />
                            <ThemedText variant="meta" tone="muted">
                                Add an exercise from the catalog, then set the targets for each set.
                            </ThemedText>
                        </>
                    ) : null}

                    {exercises.map((exercise, exIndex) => (
                        <View key={`${exercise.exerciseId}-${exIndex}`}>
                            <Spacer height={Space.md} />
                            <ExerciseSetEditor
                                name={exercise.name}
                                fields={exercise.fields}
                                sets={exercise.sets}
                                hint="Targets - blank where a measurement doesn't apply"
                                editable={!saving}
                                onChangeSet={(setIndex, field, value) => updateSet(exIndex, setIndex, field, value)}
                                onAddSet={() => addSet(exIndex)}
                                onRemoveSet={(setIndex) => removeSet(exIndex, setIndex)}
                                onRemoveExercise={() => removeExercise(exIndex)}
                            />
                        </View>
                    ))}

                    <Spacer height={Space.md} />
                    <Pressable onPress={() => setPickerOpen(true)} disabled={saving}>
                        <ThemedText tone="accent" style={styles.addLink}>
                            + Add Exercise
                        </ThemedText>
                    </Pressable>

                    {error ? (
                        <>
                            <Spacer height={Space.lg} />
                            <ThemedText variant="body" tone="danger">
                                {error}
                            </ThemedText>
                        </>
                    ) : null}

                    <Spacer height={Space.xl} />
                    <ThemedButton onPress={handleSave} disabled={saving}>
                        <ThemedText variant="cardTitle" tone="onPrimary">
                            {saving ? 'Saving...' : 'Save Template'}
                        </ThemedText>
                    </ThemedButton>
                    <Spacer height={Space.xl} />
                </ScrollView>
            </ScreenEnter>

            <ExercisePicker
                visible={pickerOpen}
                onSelect={handlePickExercise}
                onClose={() => setPickerOpen(false)}
            />
        </ThemedView>
    )
}

export default NewWorkoutTemplate

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SCREEN_PADDING,
    },
    scrollContent: {
        paddingBottom: Space.xl,
    },
    label: {
        marginBottom: Space.xs + 2,
    },
    addLink: {
        fontFamily: FontFamily.label,
        fontSize: 12,
    },
})
