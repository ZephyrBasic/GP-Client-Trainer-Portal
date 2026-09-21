import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { deleteDoc, doc, onSnapshot } from 'firebase/firestore'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import { PlaceholderRows } from '../../../components/Placeholder'
import ThemedTextInput from '../../../components/ThemedTextInput'
import ThemedCard from '../../../components/ThemedCard'
import ThemedButton, { buttonTextColor } from '../../../components/ThemedButton'
import SessionDiff from '../../../components/SessionDiff'
import VerdictBadge, { SessionKindChip } from '../../../components/VerdictBadge'
import Spacer from '../../../components/Spacer'
import { Colors } from '../../../constants/Colors'
import { Space, SCREEN_PADDING } from '../../../constants/Layout'
import { db } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'
import { useLeave } from '../../../hooks/useLeave'
import { SESSIONS } from '../../../hooks/useSessions'
import {
    createWorkoutTemplate,
    suggestedTemplateName,
    templateExercisesFrom,
} from '../../../hooks/useWorkoutTemplates'
import { deviations } from '../../../utils/prescription'
import { formatSet } from '../../../utils/formatSet'
import { shortDateLabel } from '../../../utils/dateInput'
import { sessionDurationLabel } from '../../../utils/elapsed'

const WorkoutDetail = () => {
    const { id } = useLocalSearchParams<{ id: string }>()
    // Normally History is underneath (finishing a Session puts it there); from
    // a direct link or a refresh nothing is, and back goes to History anyway.
    const { leave } = useLeave({ home: '/workouts', homeLabel: 'History' })
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { profile } = useAuth()

    const [workout, setWorkout] = useState(null)
    const [loading, setLoading] = useState(true)
    const [accessDenied, setAccessDenied] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showDiff, setShowDiff] = useState(false)

    // Turning this record back into a plan - the same thing the finish card
    // offers while a Session is still open, offered again here because the
    // moment a Client decides "that was a good one" is usually the next day.
    const [naming, setNaming] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templateError, setTemplateError] = useState('')
    const [savedTemplate, setSavedTemplate] = useState(false)

    useEffect(() => {
        if (!id) return
        const unsubscribe = onSnapshot(
            doc(db, SESSIONS, id),
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

    const startNaming = () => {
        setTemplateError('')
        setTemplateName((prev) => prev || suggestedTemplateName(workout?.exercises))
        setNaming(true)
    }

    const handleSaveTemplate = async () => {
        const trimmed = templateName.trim()
        if (!trimmed) {
            setTemplateError('Give the template a name.')
            return
        }

        setTemplateError('')
        setSavingTemplate(true)
        try {
            // Authored by the Client, not by whoever prescribed the Session
            // this came from: a Template is one object whoever wrote it, and
            // this one is theirs. It is not assigned to anybody and carries no
            // Target Frequency - it simply appears in their own list.
            await createWorkoutTemplate({
                authorId: profile.uid,
                name: trimmed,
                exercises: templateExercisesFrom(workout.exercises),
            })
            setNaming(false)
            setSavedTemplate(true)
        } catch (err) {
            setTemplateError(err.message || 'Could not save that as a template.')
        }
        setSavingTemplate(false)
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await deleteDoc(doc(db, SESSIONS, id))
            leave()
        } catch (err) {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <ThemedView style={styles.container}>
                <PlaceholderRows />
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

    const dateLabel = workout.date?.toDate ? shortDateLabel(workout.date.toDate()) : 'Unknown date'
    const exerciseCount = workout.exercises?.length ?? 0
    // Absent rather than zero: a duration nobody recorded is not a workout that
    // took no time, so the whole clause is left off.
    const durationLabel = sessionDurationLabel(workout)
    // Both stored at completion and never recomputed (ADR 0002), so what this
    // screen shows cannot drift from the verdict as Versions are published
    // afterwards. A Session with no diff is either Self-Directed or one whose
    // plan never reached the phone; neither has anything to itemise.
    const changes = deviations(workout.diff)
    const canSaveAsTemplate =
        Boolean(profile?.uid) && workout.clientId === profile.uid && exerciseCount > 0

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* The record's head is drawn exactly like a row of History -
                    same name, same meta line, same verdict pill - since this
                    screen is what that row opens into. The diff (when there is
                    one) sits inside the same card, behind the same
                    show/hide toggle .claude/docs/design/Review.dc.html draws. */}
                <ThemedCard>
                    <View style={styles.headRow}>
                        <View style={styles.textCol}>
                            {/* Which workout this was, said in the same
                                one-line form every other screen uses. A Session
                                with no Template says so rather than leaving a
                                gap - "no plan" is a real answer, not a missing
                                name. */}
                            <ThemedText variant="cardTitle" tone="title" numberOfLines={1}>
                                {workout.templateName || 'Session without a plan'}
                            </ThemedText>
                            <ThemedText variant="small" tone="muted">
                                {dateLabel} · {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}
                                {durationLabel ? ` · ${durationLabel}` : ''}
                            </ThemedText>
                        </View>
                        <VerdictBadge verdict={workout.verdict} />
                        <SessionKindChip session={workout} />
                    </View>

                    {/* The itemisation, and deliberately behind a tap: what the
                        Client did is the record, and what they were asked for
                        is the question they open when they want it. A Session
                        with no diff shows no control at all rather than an
                        empty one. */}
                    {workout.diff?.length ? (
                        <>
                            <View style={[styles.divider, { backgroundColor: theme.lineSoft }]} />
                            {showDiff ? (
                                <>
                                    <SessionDiff diff={workout.diff} />
                                    <Spacer height={Space.md} />
                                    <Pressable onPress={() => setShowDiff(false)}>
                                        <ThemedText variant="small" tone="accent" style={styles.diffToggle}>
                                            Hide comparison
                                        </ThemedText>
                                    </Pressable>
                                </>
                            ) : (
                                <Pressable onPress={() => setShowDiff(true)}>
                                    <ThemedText variant="small" tone="accent" style={styles.diffToggle}>
                                        {changes.length > 0
                                            ? `Show what changed · ${changes.length} exercise${changes.length === 1 ? '' : 's'}`
                                            : 'Show the comparison'}
                                    </ThemedText>
                                </Pressable>
                            )}
                        </>
                    ) : null}
                </ThemedCard>

                <Spacer height={Space.xl} />
                {(workout.exercises ?? []).map((exercise, index) => (
                    <View key={index}>
                        <Spacer height={index === 0 ? 0 : Space.md} />
                        <ThemedCard>
                            <ThemedText variant="cardTitle" tone="title">
                                {exercise.name}
                            </ThemedText>
                            <Spacer height={Space.sm} />
                            {(exercise.sets ?? []).map((set, setIndex) => (
                                <ThemedText key={setIndex} variant="small" tone="faint" style={styles.setLine}>
                                    Set {setIndex + 1}: {formatSet(set)}
                                </ThemedText>
                            ))}
                        </ThemedCard>
                    </View>
                ))}

                {workout.notes ? (
                    <>
                        <Spacer height={Space.xl} />
                        <ThemedCard>
                            <ThemedText variant="label" tone="muted">Notes</ThemedText>
                            <Spacer height={Space.xs} />
                            <ThemedText variant="body" tone="body">{workout.notes}</ThemedText>
                        </ThemedCard>
                    </>
                ) : null}

                {/* Only the Client whose Session this is, and only once there
                    is something to make a plan out of. A Trainer reaches this
                    same route from their client's history, and a Template
                    authored under their name out of someone else's workout is
                    not a thing this app has a meaning for. */}
                {canSaveAsTemplate ? (
                    <>
                        <Spacer height={Space.xxl} />
                        {savedTemplate ? (
                            <ThemedCard>
                                <ThemedText variant="body" tone="accent">
                                    Saved. It&apos;s in your own workouts now.
                                </ThemedText>
                            </ThemedCard>
                        ) : !naming ? (
                            <ThemedButton variant="ghost" onPress={startNaming}>
                                <ThemedText variant="body" tone="body">
                                    Create template from this workout
                                </ThemedText>
                            </ThemedButton>
                        ) : (
                            <ThemedCard>
                                <ThemedText variant="label" tone="muted">TEMPLATE NAME</ThemedText>
                                <Spacer height={Space.sm} />
                                <ThemedTextInput
                                    value={templateName}
                                    onChangeText={setTemplateName}
                                    placeholder="Name this workout"
                                    autoCapitalize="words"
                                    editable={!savingTemplate}
                                />
                                <Spacer height={Space.sm} />
                                {/* Said before the button rather than found
                                    out afterwards: the numbers that get
                                    prescribed are the ones that were
                                    performed, which is the point but is worth
                                    stating once. */}
                                <ThemedText variant="small" tone="muted">
                                    The sets you recorded become its targets. You can change them any time.
                                </ThemedText>
                                {templateError ? (
                                    <>
                                        <Spacer height={Space.sm} />
                                        <ThemedText variant="small" tone="danger">{templateError}</ThemedText>
                                    </>
                                ) : null}
                                <Spacer height={Space.md} />
                                <View style={styles.confirmRow}>
                                    <ThemedButton
                                        variant="ghost"
                                        onPress={() => setNaming(false)}
                                        style={styles.confirmBtn}
                                        disabled={savingTemplate}
                                    >
                                        <ThemedText>Cancel</ThemedText>
                                    </ThemedButton>
                                    <ThemedButton
                                        onPress={handleSaveTemplate}
                                        style={styles.confirmBtn}
                                        disabled={savingTemplate}
                                    >
                                        <ThemedText variant="body" tone="onPrimary">
                                            {savingTemplate ? 'Saving...' : 'Save template'}
                                        </ThemedText>
                                    </ThemedButton>
                                </View>
                            </ThemedCard>
                        )}
                    </>
                ) : null}

                <Spacer height={Space.xxl} />
                {!confirmingDelete ? (
                    <ThemedButton variant="danger" onPress={() => setConfirmingDelete(true)}>
                        <ThemedText style={{ color: buttonTextColor('danger', theme), fontWeight: '600' }}>
                            Delete Workout
                        </ThemedText>
                    </ThemedButton>
                ) : (
                    <View>
                        <ThemedText variant="body" tone="body">Delete this workout? This cannot be undone.</ThemedText>
                        <Spacer height={Space.md} />
                        <View style={styles.confirmRow}>
                            <ThemedButton
                                variant="ghost"
                                onPress={() => setConfirmingDelete(false)}
                                style={styles.confirmBtn}
                                disabled={deleting}
                            >
                                <ThemedText>Cancel</ThemedText>
                            </ThemedButton>
                            <ThemedButton
                                variant="destructive"
                                onPress={handleDelete}
                                style={styles.confirmBtn}
                                disabled={deleting}
                            >
                                <ThemedText style={{ color: buttonTextColor('destructive', theme), fontWeight: '600' }}>
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
        padding: SCREEN_PADDING,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    headRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md,
    },
    textCol: {
        flex: 1,
        gap: Space.xs,
    },
    divider: {
        height: 1,
        marginVertical: Space.md,
    },
    diffToggle: {
        fontWeight: '600',
    },
    setLine: {
        marginBottom: 2,
    },
    confirmRow: {
        flexDirection: 'row',
        gap: Space.md,
    },
    confirmBtn: {
        flex: 1,
    },
})
