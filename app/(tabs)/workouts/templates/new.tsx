import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'

import ThemedView from '../../../../components/ThemedView'
import ThemedText from '../../../../components/ThemedText'
import ThemedTextInput from '../../../../components/ThemedTextInput'
import ThemedButton from '../../../../components/ThemedButton'
import Spacer from '../../../../components/Spacer'
import ScreenEnter from '../../../../components/ScreenEnter'
import SectionLabel from '../../../../components/SectionLabel'
import ExercisePicker from '../../../../components/ExercisePicker'
import ExerciseSetEditor from '../../../../components/ExerciseSetEditor'
import AddButton from '../../../../components/AddButton'
import FieldError from '../../../../components/FieldError'
import { showToast } from '../../../../components/Toast'
import { Space, SCREEN_PADDING } from '../../../../constants/Layout'
import { useAuth } from '../../../../contexts/AuthContext'
import { useExerciseDraft } from '../../../../hooks/useExerciseDraft'
import { useLeave } from '../../../../hooks/useLeave'
import { createWorkoutTemplate } from '../../../../hooks/useWorkoutTemplates'
import { blankTargetError, storedSetFrom } from '../../../../utils/setDraft'

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
    // Each drawn under what it is about, all at once (.claude/rules/ui.md).
    const [errors, setErrors] = useState<{ name?: string; exercises?: string; form?: string; sets?: Record<number, string> }>({})
    const [saving, setSaving] = useState(false)
    const nameRef = useRef<TextInput>(null)
    const scrollRef = useRef<ScrollView>(null)

    // One empty row per Exercise, which is the hook's own default. Nothing is
    // prefilled from history here: a Template is what the author intends, not
    // what anyone last did.
    const { exercises, pickExercise, updateSet, addSet, removeSet, removeExercise } = useExerciseDraft()

    const handlePickExercise = (exercise) => {
        setPickerOpen(false)
        pickExercise(exercise)
        setErrors((prev) => ({ ...prev, exercises: undefined }))
    }

    const handleSave = async () => {
        const trimmedName = name.trim()
        const sets = Object.fromEntries(
            exercises
                .map((ex, i) => [i, blankTargetError(ex.sets, ex.fields)])
                .filter(([, message]) => message)
        )
        const found = {
            name: trimmedName ? undefined : 'Name the template.',
            exercises: exercises.length === 0 ? 'Add at least one exercise.' : undefined,
            sets,
        }
        setErrors(found)
        if (found.name) return nameRef.current?.focus()
        if (found.exercises || Object.keys(sets).length) return scrollRef.current?.scrollToEnd({ animated: true })

        const targetExercises = exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            fields: ex.fields,
            // Every row the author left stands: the number of target Sets is
            // part of the plan. A row blank in *every* box is refused above
            // rather than dropped here, which would quietly prescribe less work.
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
            showToast(`${trimmedName} saved`)
        } catch (err) {
            setErrors({ form: err.message || 'Failed to save the template.' })
            setSaving(false)
        }
    }

    return (
        <ThemedView style={styles.container}>
            <ScreenEnter play={fromToday}>
                <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <ThemedText variant="meta" tone="muted" style={styles.label}>
                        Name
                    </ThemedText>
                    {/* Not a real Template's name as the placeholder: "Upper Body
                        A" made an empty form look already filled in. */}
                    <ThemedTextInput
                        ref={nameRef}
                        accessibilityLabel="Name"
                        value={name}
                        onChangeText={(text) => {
                            setName(text)
                            setErrors((prev) => ({ ...prev, name: undefined }))
                        }}
                        placeholder="Name this template"
                        autoCapitalize="words"
                        editable={!saving}
                        invalid={Boolean(errors.name)}
                    />
                    <FieldError>{errors.name}</FieldError>

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
                            <Spacer height={Space.xl} />
                            <ExerciseSetEditor
                                name={exercise.name}
                                fields={exercise.fields}
                                sets={exercise.sets}
                                hint="Targets. Leave a box blank if it doesn't apply."
                                editable={!saving}
                                error={errors.sets?.[exIndex]}
                                onChangeSet={(setIndex, field, value) => {
                                    updateSet(exIndex, setIndex, field, value)
                                    if (errors.sets?.[exIndex]) setErrors((prev) => ({ ...prev, sets: { ...prev.sets, [exIndex]: undefined } }))
                                }}
                                onAddSet={() => addSet(exIndex)}
                                onRemoveSet={(setIndex) => removeSet(exIndex, setIndex)}
                                onRemoveExercise={() => removeExercise(exIndex)}
                            />
                        </View>
                    ))}

                    <Spacer height={Space.xl} />
                    <AddButton label="Add exercise" onPress={() => setPickerOpen(true)} disabled={saving} />
                    <FieldError>{errors.exercises}</FieldError>
                    <FieldError>{errors.form}</FieldError>

                    <Spacer height={Space.xl} />
                    <ThemedButton onPress={handleSave} disabled={saving}>
                        <ThemedText variant="cardTitle" tone="onPrimary">
                            {saving ? 'Saving...' : 'Save template'}
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
})
