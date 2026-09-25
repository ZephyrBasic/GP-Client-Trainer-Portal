import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View, useColorScheme } from 'react-native'
import Pressable from '../../../components/Touchable'
import { Ionicons } from '@expo/vector-icons'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedTextInput from '../../../components/ThemedTextInput'
import ThemedButton from '../../../components/ThemedButton'
import OfflineBanner from '../../../components/OfflineBanner'
import ScreenEnter from '../../../components/ScreenEnter'
import Spacer from '../../../components/Spacer'
import SectionLabel from '../../../components/SectionLabel'
import DateField from '../../../components/DateField'
import FieldError from '../../../components/FieldError'
import { showToast } from '../../../components/Toast'
import ExercisePicker from '../../../components/ExercisePicker'
import ExerciseSetEditor from '../../../components/ExerciseSetEditor'
import WorkoutPlanPicker from '../../../components/WorkoutPlanPicker'
import { Colors } from '../../../constants/Colors'
import { Radius, Space, SCREEN_PADDING } from '../../../constants/Layout'
import { useAuth } from '../../../contexts/AuthContext'
import { useAssignment, useClientAssignments } from '../../../hooks/useAssignments'
import { draftsFrom, useExerciseDraft } from '../../../hooks/useExerciseDraft'
import { useLeave } from '../../../hooks/useLeave'
import { useOffline } from '../../../hooks/useOffline'
import { createManualSession, useSessions } from '../../../hooks/useSessions'
import { useTemplateVersion, useWorkoutTemplates } from '../../../hooks/useWorkoutTemplates'
import { toDateInput, parseDateInput, sessionDateError } from '../../../utils/dateInput'
import { durationError, minutesFromSeconds, parseDurationInput } from '../../../utils/elapsed'
import { buildExerciseHistory, prefillSetsFor, previousSetSummary } from '../../../utils/exerciseHistory'
import { targetSummary } from '../../../utils/formatSet'
import AddButton from '../../../components/AddButton'
import { compareSession, resolveTargets } from '../../../utils/prescription'
import { emptySetDraft, hasMeasurement, setDraftFrom, storedSetFrom } from '../../../utils/setDraft'

/**
 * A Session that has already happened, written down afterwards.
 *
 * Clients train without their phone, so the whole workout has to be enterable
 * later: pick the day it counts for, fill in what was done, save. No timer runs
 * and no document is opened first - this is one write, already `completed` (see
 * createManualSession).
 *
 * It can be entered against a Workout Template as well as free-form, and that is
 * the point of ticket 11 rather than a convenience: training away from the app
 * would otherwise silently become Self-Directed, so a Client who does their
 * prescribed workout in a hotel gym would lose the verdict and the diff on it.
 * Naming the plan here earns both, through the same two helpers a live Session
 * goes through.
 *
 * What it deliberately does *not* do is reproduce the live screen's check-off.
 * There is no tick here because there was no moment to tick in: the Client is
 * recalling a finished workout, so every row on screen is a claim about what
 * they did, and an Exercise they skipped is removed rather than left unticked.
 */
const LogWorkout = () => {
    const { profile } = useAuth()
    // Opened from Today, so saving goes back there (hooks/useLeave).
    const { leave, fromToday } = useLeave({ home: '/workouts', homeLabel: 'History' })
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const { sessions, offline: sessionsOffline, retry: retrySessions } = useSessions(profile?.uid)
    const history = useMemo(() => buildExerciseHistory(sessions), [sessions])

    const {
        assignments,
        offline: assignmentsOffline,
        retry: retryAssignments,
    } = useClientAssignments(profile?.uid)
    // A workout the Client saved for themselves was still a plan, so a Session
    // entered afterwards can name it and be judged against it.
    const {
        templates: ownTemplates,
        offline: templatesOffline,
        retry: retryTemplates,
    } = useWorkoutTemplates(profile?.uid)

    // Which Template this Session ran, or null for a workout nobody prescribed.
    // Held as the three fields a Session stores rather than as the whole
    // Template, because that is all that travels with it (see prescribedFields).
    const [plan, setPlan] = useState(null)

    const { version, loading: versionLoading, offline: versionOffline, retry: retryVersion } =
        useTemplateVersion(plan?.templateId, plan?.versionId)
    const {
        assignment,
        loading: assignmentLoading,
        offline: assignmentOffline,
        retry: retryAssignment,
    } = useAssignment(plan?.templateId, profile?.uid)

    const offline = useOffline(
        sessionsOffline,
        assignmentsOffline,
        templatesOffline,
        versionOffline,
        assignmentOffline
    )

    // Five reads behind one banner button: any of them can be the one that timed
    // out and the Client cannot tell which.
    const retry = () => {
        retrySessions()
        retryAssignments()
        retryTemplates()
        retryVersion()
        retryAssignment()
    }

    // Today in the device's own calendar - see utils/dateInput for why that is
    // not the same as today's date in UTC.
    const [date, setDate] = useState(() => toDateInput(new Date()))
    const [duration, setDuration] = useState('')
    const [notes, setNotes] = useState('')
    const [pickerOpen, setPickerOpen] = useState(false)
    // One slot per field, drawn under the box it is about (.claude/rules/ui.md).
    const [errors, setErrors] = useState<{ form?: string; exercises?: string; duration?: string; date?: string }>({})
    const clearError = (field: 'form' | 'exercises' | 'duration' | 'date') =>
        setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
    const [saving, setSaving] = useState(false)
    const scrollRef = useRef<ScrollView>(null)
    const durationRef = useRef<TextInput>(null)
    const dateRef = useRef<TextInput>(null)
    // Where the Exercises section starts, so a save refused for having none
    // can bring it into view - there is no box there to focus.
    const exercisesY = useRef(0)

    const { exercises, setExercises, pickExercise, updateSet, addSet, removeSet, removeExercise } =
        useExerciseDraft([], (exercise, fields) => {
            // Empty on a first attempt, otherwise seeded with what they did last
            // time. This is for Exercises added by hand, and stays right even
            // with a plan chosen: an Exercise the Client added on the day was
            // never prescribed, so history is the only thing that can prefill it.
            const prefilled = prefillSetsFor(exercise, history).map((set) => setDraftFrom(set, fields))
            return {
                sets: prefilled.length ? prefilled : [emptySetDraft(fields)],
                previous: previousSetSummary(exercise, history),
            }
        })

    // What *this* Client was asked for on the chosen plan - their own loads on
    // top of the Version, exactly as the live screen resolves them. Every part
    // of that judgement stays in utils/prescription: a second implementation of
    // ADR 0004's rule would drift, and the two would disagree about what the
    // Client was asked to do.
    //
    // Null while the Assignment is still answering, so the form is never
    // prefilled with the shared Template's loads and then left with no way to
    // correct them - the plan is applied once. A null Assignment is an answer
    // too, and the right one for a Template the Client wrote themselves.
    const targets = useMemo(
        () => (plan && version && !assignmentLoading ? resolveTargets(version, assignment) : null),
        [plan, version, assignment, assignmentLoading]
    )

    // Which plan the rows on screen were filled from. The snapshot helper
    // subscribes with includeMetadataChanges, so a Version arrives more than
    // once with identical contents; without this guard the second delivery would
    // wipe whatever the Client had typed since the first.
    const [filledFrom, setFilledFrom] = useState(null)

    useEffect(() => {
        if (!targets || filledFrom === plan.versionId) return
        // Prefilled with the targets rather than left blank, because that is
        // what the Client is here to correct: they did roughly the prescribed
        // workout and want to say where it differed. Unlike the live screen
        // there is no tick to distinguish "done" from "shown", so every row that
        // stands is a claim - an Exercise they didn't do is removed.
        setExercises(draftsFrom(targets).map((draft, index) => ({
            ...draft,
            previous: targetSummary(targets[index].sets),
        })))
        setFilledFrom(plan.versionId)
    }, [targets, plan, filledFrom])

    const choosePlan = (template) => {
        clearError('exercises')
        // Changing the plan replaces the rows, because they were the previous
        // plan's targets rather than anything the Client typed - and the moment
        // to pick a workout is before filling one in.
        setExercises([])
        setFilledFrom(null)
        setPlan(
            template
                ? {
                      templateId: template.id,
                      versionId: template.currentVersionId,
                      name: template.name,
                  }
                : null
        )
    }

    const handlePickExercise = (exercise) => {
        setPickerOpen(false)
        pickExercise(exercise)
        clearError('exercises')
    }

    const handleSave = async () => {
        const cleanedExercises = exercises
            .map((ex) => ({
                exerciseId: ex.exerciseId,
                name: ex.name,
                fields: ex.fields,
                // A set counts as logged if any of its fields has a value - a 45s
                // plank and a bodyweight pushup are both valid without a weight.
                sets: ex.sets.map((set) => storedSetFrom(set, ex.fields)).filter(hasMeasurement),
            }))
            .filter((ex) => ex.sets.length > 0)

        // Every problem at once, in the order they sit on screen, and the
        // first bad box focused. Blank duration is fine: it saves as
        // unrecorded rather than as a workout that took no time.
        const found = {
            date: sessionDateError(date) ?? undefined,
            duration: durationError(duration) ?? undefined,
            exercises: cleanedExercises.length === 0 ? 'Add at least one exercise with a set filled in.' : undefined,
        }
        setErrors(found)
        if (found.date) return dateRef.current?.focus()
        if (found.duration) return durationRef.current?.focus()
        if (found.exercises) return scrollRef.current?.scrollTo({ y: Math.max(0, exercisesY.current - Space.lg), animated: true })

        const parsedDate = parseDateInput(date)
        const parsedSeconds = parseDurationInput(duration)

        setSaving(true)
        try {
            await createManualSession({
                clientId: profile.uid,
                exercises: cleanedExercises,
                // Seconds are what the box now holds; the rounded minutes ride
                // along beside them so every reader that only knows about
                // `durationMinutes` keeps working - see completeSession.
                durationSeconds: parsedSeconds,
                durationMinutes: parsedSeconds == null ? null : minutesFromSeconds(parsedSeconds),
                notes: notes.trim(),
                date: parsedDate,
                // All three or none, enforced one level down by prescribedFields
                // so the two ways of recording a Session cannot obey the rule
                // differently.
                templateId: plan?.templateId,
                versionId: plan?.versionId,
                templateName: plan?.name,
                // Judged once, here, and never again (ADR 0002). Null for a
                // workout with no plan, and null too if the chosen plan's
                // Version never reached the phone - the Session still records
                // which workout it was, but no verdict is written, because we
                // did not compare rather than compared and found nothing to say.
                comparison: compareSession(cleanedExercises, targets),
            })
            leave()
            showToast('Session saved')
        } catch (err) {
            setErrors({ form: err.message || 'Failed to save this session.' })
            setSaving(false)
        }
    }

    // A plan was chosen and its targets have not arrived. Said out loud rather
    // than left as an empty form, because the rows are about to appear
    // underneath and a Client who starts typing into an empty screen would have
    // their work replaced when they land.
    const planPending = Boolean(plan) && !targets

    return (
        <ThemedView style={styles.container}>
            <ScreenEnter play={fromToday}>
                <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <OfflineBanner visible={offline} onRetry={retry} />

                    {/* First, because it decides what the rest of the form is
                        prefilled with - and because "which workout was this?" is
                        a question about the whole entry, not about one exercise. */}
                    <WorkoutPlanPicker
                        assignments={assignments}
                        templates={ownTemplates}
                        selectedTemplateId={plan?.templateId}
                        onSelect={choosePlan}
                        disabled={saving}
                    />
                    {assignments.length > 0 || ownTemplates.length > 0 ? <Spacer height={Space.lg} /> : null}

                    <ThemedText variant="meta" tone="muted" style={styles.label}>Date</ThemedText>
                    <DateField
                        value={date}
                        onChange={(text) => {
                            setDate(text)
                            clearError('date')
                        }}
                        editable={!saving}
                        error={errors.date}
                        inputRef={dateRef}
                    />

                    <Spacer height={Space.lg} />
                    <ThemedText variant="meta" tone="muted" style={styles.label}>Duration</ThemedText>
                    {/* By hand, because no timer ran. Blank saves as unrecorded
                        rather than as a workout that took no time. */}
                    <ThemedTextInput
                        ref={durationRef}
                        accessibilityLabel="Duration"
                        value={duration}
                        onChangeText={(text) => {
                            setDuration(text)
                            clearError('duration')
                        }}
                        placeholder="mm:ss"
                        keyboardType="numbers-and-punctuation"
                        editable={!saving}
                    />
                    {errors.duration ? (
                        <FieldError>{errors.duration}</FieldError>
                    ) : (
                        <ThemedText variant="small" tone="muted" style={styles.hint}>
                            Minutes and seconds, as 45:00. A plain number is read as minutes.
                        </ThemedText>
                    )}

                    <Spacer height={Space.xl} />
                    <View onLayout={(e) => (exercisesY.current = e.nativeEvent.layout.y)}>
                        <SectionLabel>EXERCISES</SectionLabel>
                    </View>

                    {planPending ? (
                        <>
                            <Spacer height={Space.sm} />
                            <ThemedText variant="meta" tone="muted">
                                {versionLoading || assignmentLoading
                                    ? 'Loading that workout...'
                                    : "That workout's plan hasn't reached your phone. Add what you did — it's still recorded as that workout."}
                            </ThemedText>
                        </>
                    ) : exercises.length === 0 ? (
                        <>
                            <Spacer height={Space.sm} />
                            <ThemedText variant="meta" tone="muted">
                                Add an exercise from the library to start logging.
                            </ThemedText>
                        </>
                    ) : null}

                    {plan && exercises.length > 0 ? (
                        <>
                            <Spacer height={Space.sm} />
                            {/* The one place this differs from checking off a live
                                Session, and worth a sentence: there is nothing to
                                tick, so a row that stands is a row that happened. */}
                            <ThemedText variant="meta" tone="muted">
                                Filled in with what you were asked for. Change the numbers you changed, and remove
                                anything you didn&apos;t do.
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
                                hint={exercise.previous}
                                editable={!saving}
                                onChangeSet={(setIndex, field, value) => updateSet(exIndex, setIndex, field, value)}
                                onAddSet={() => addSet(exIndex)}
                                onRemoveSet={(setIndex) => removeSet(exIndex, setIndex)}
                                onRemoveExercise={() => removeExercise(exIndex)}
                            />
                        </View>
                    ))}

                    <Spacer height={Space.xl} />
                    {/* Styled like the live session's own "Add exercise" pill
                        (app/(tabs)/workouts/session/[sessionId].tsx) rather than a
                        bare link, so the one control both screens share for this
                        reads the same wherever a Client meets it. */}
                    <AddButton label="Add exercise" onPress={() => setPickerOpen(true)} disabled={saving} />
                    <FieldError>{errors.exercises}</FieldError>

                    <Spacer height={Space.xl} />
                    <ThemedText variant="meta" tone="muted" style={styles.label}>Notes</ThemedText>
                    <ThemedTextInput
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="How did it feel?"
                        multiline
                        numberOfLines={3}
                        style={styles.notesInput}
                        editable={!saving}
                    />

                    <FieldError>{errors.form}</FieldError>

                    <Spacer height={Space.xl} />
                    <ThemedButton onPress={handleSave} disabled={saving}>
                        <ThemedText variant="cardTitle" tone="onPrimary">
                            {saving ? 'Saving...' : 'Save session'}
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

export default LogWorkout

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SCREEN_PADDING,
    },
    scrollContent: {
        paddingBottom: Space.xl,
    },
    label: {
        marginBottom: Space.sm - 2,
    },
    hint: {
        marginTop: Space.xs + 2,
    },
    addExercisePill: {
        minHeight: 44,
        borderWidth: 1,
        borderRadius: Radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.xs + 3,
    },
    notesInput: {
        minHeight: 80,
        textAlignVertical: 'top',
        paddingTop: Space.md,
    },
})
