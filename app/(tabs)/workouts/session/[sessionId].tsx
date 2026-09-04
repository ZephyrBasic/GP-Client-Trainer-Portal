import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'

import ThemedView from '../../../../components/ThemedView'
import ThemedText from '../../../../components/ThemedText'
import ThemedTextInput from '../../../../components/ThemedTextInput'
import ThemedButton from '../../../../components/ThemedButton'
import ThemedCard from '../../../../components/ThemedCard'
import OfflineBanner from '../../../../components/OfflineBanner'
import ProgressBar from '../../../../components/ProgressBar'
import Spacer from '../../../../components/Spacer'
import ExercisePicker from '../../../../components/ExercisePicker'
import ExerciseSetEditor from '../../../../components/ExerciseSetEditor'
import { Colors } from '../../../../constants/Colors'
import { Radius, Space, SCREEN_PADDING } from '../../../../constants/Layout'
import { FontFamily } from '../../../../constants/Type'
import { useAssignment } from '../../../../hooks/useAssignments'
import { draftsFrom, useExerciseDraft } from '../../../../hooks/useExerciseDraft'
import { useOffline } from '../../../../hooks/useOffline'
import { completeSession, isActiveSession, useSession } from '../../../../hooks/useSessions'
import { useTemplateVersion } from '../../../../hooks/useWorkoutTemplates'
import { toDateInput, parseDateInput } from '../../../../utils/dateInput'
import { compareSession, resolveTargets } from '../../../../utils/prescription'
import {
    elapsedSecondsBetween,
    formatElapsed,
    minutesFromSeconds,
    parseDurationInput,
} from '../../../../utils/elapsed'
import { summariseSets } from '../../../../utils/formatSet'
import {
    clearLiveSessionDraft,
    getLiveSessionDraft,
    saveLiveSessionDraft,
} from '../../../../utils/liveSessionDraft'
import { hasMeasurement, storedSetFrom } from '../../../../utils/setDraft'

/**
 * "Target 5 × 5 reps × 60 kg", said once for the live header.
 *
 * Built from `summariseSets` rather than the shared `targetSummary` in
 * utils/formatSet: that helper's "Target: ..." colon reads fine as a form
 * label on manual entry, which still uses it, but Signal's header sets the
 * word itself apart with tone rather than punctuation. Kept local rather than
 * changed at the source, since two other screens still want the colon.
 */
const targetLine = (sets) => {
    const summary = summariseSets(sets)
    return summary ? `Target ${summary}` : undefined
}

/**
 * Opens the targets for performing: the shared draft builder, plus the two
 * things only this screen wants on a row - an unticked checkbox per Set, and the
 * line saying what that Set was asked to be.
 *
 * Mapped by index over what the builder returns, which is safe because that is a
 * plain 1:1 map over the Exercises handed in.
 */
const draftsFromTargets = (targetExercises) =>
    draftsFrom(targetExercises).map((draft, index) => ({
        ...draft,
        checked: draft.sets.map(() => false),
        target: targetLine(targetExercises[index].sets),
        // The original prescribed values, held apart from `sets` - which
        // mutates as the Client edits and ticks - so a departed row can still
        // say what it was asked for after being typed over. Untouched by
        // addSet/removeSet, so a Set added past this length simply has no
        // entry here, which is what tells the editor there is nothing for it
        // to have departed from.
        targetSets: draft.sets,
    }))

const checkedCount = (exercise) => (exercise.checked ?? []).filter(Boolean).length

/**
 * Performing a Session.
 *
 * The screen the whole feature exists for. A Session document is already open by
 * the time this renders - the workout list created it, so the clock was running
 * before the first frame - and this reads it back to find the Template Version
 * it cites, prefills the targets from that Version, and lets the Client work
 * through them.
 *
 * Nothing they do here is written until they finish. Ticking a Set, changing a
 * load, adding an Exercise: all of it is local state, saved in one write at
 * completion (see hooks/useSessions). That is not an optimisation - a Session
 * rewritten twenty times is not the record a Trainer can trust as history.
 *
 * The plan is a nicety, not a precondition. If the Version cannot be read - a
 * basement, a dead connection, a read that answers in thirty seconds - the
 * screen opens empty and the Client trains anyway, and the targets merge in
 * underneath their work if they arrive. Nothing the Client enters is ever
 * replaced by something that loads afterwards; losing a Set someone actually
 * performed is worse than any missing target.
 *
 * Deviation is recorded, never blocked. The Client can change any number, add
 * Sets past what was prescribed, add Exercises that were not on the plan, and
 * skip ones that were; the Session is still recorded as that workout, which is
 * what keeps their history organised by what they set out to do. Judging the
 * difference is ticket 10's job and happens once, at completion.
 *
 * The screen draws its own header and footer rather than the Stack's native
 * one (see app/(tabs)/workouts/_layout.tsx) - the clock has to survive
 * whatever the Client scrolls past, and the footer's FINISH has to say what it
 * saves. One scrolling stack of every Exercise, never a focused rail: that was
 * considered and set aside on 2026-08-30 (.claude/docs/design/TOKENS.md),
 * since progress here is counted in Sets across the whole Session, not paged
 * Exercise by Exercise.
 */
const LiveSession = () => {
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
    const router = useRouter()
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const insets = useSafeAreaInsets()

    const { session, loading: sessionLoading, offline: sessionOffline, retry: retrySession } =
        useSession(sessionId)
    // Null for a Self-Directed Session, and the hook subscribes to nothing then.
    const { version, loading: versionLoading, offline: versionOffline, retry: retryVersion } =
        useTemplateVersion(session?.templateId, session?.versionId)
    // This Client's own target loads. Keyed off the Session's own clientId
    // rather than the signed-in profile: the Session names whose it is, and the
    // rules only hand it to that Client anyway.
    const {
        assignment,
        loading: assignmentLoading,
        offline: assignmentOffline,
        retry: retryAssignment,
    } = useAssignment(session?.templateId, session?.clientId)
    const offline = useOffline(sessionOffline, versionOffline, assignmentOffline)

    // Any of the three can be the one that timed out and the banner offers one
    // button, so retry means retry all of them.
    const retry = () => {
        retrySession()
        retryVersion()
        retryAssignment()
    }

    const {
        exercises,
        setExercises,
        pickExercise,
        updateSet,
        addSet,
        // `removeSet` is deliberately not destructured: Signal's row has no
        // per-Set remove, only Skip on the whole Exercise. Dropping the
        // control loses nothing a Client could do here before - leaving a Set
        // unticked already keeps it out of what's saved (see handleFinish).
        //
        // Skipping, not deleting: the Exercise leaves this screen, and the
        // Session is simply recorded without it. Nothing has been written yet,
        // so there is nothing to undo.
        removeExercise: skipExercise,
    } = useExerciseDraft([], () => ({
        // One empty, unticked row. An Exercise added mid-Session was never
        // prescribed, so there is no target to prefill and nothing to compare it
        // against - it is simply extra work that happened.
        checked: [false],
        target: undefined,
    }))

    const [hydrated, setHydrated] = useState(false)
    // Whether the plan is on screen. False means the Client is working without
    // it - either the Version read has not answered yet or it never will - and
    // is what lets the targets arrive late without arriving twice.
    const [planApplied, setPlanApplied] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [finishing, setFinishing] = useState(false)
    const [durationMinutes, setDurationMinutes] = useState('')
    const [date, setDate] = useState('')
    const [notes, setNotes] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    // The clock. The interval moves `now` forward and nothing else: elapsed is
    // always (now - startedAt), so a tick lost to a backgrounded app, a throttled
    // browser tab or a sleeping phone costs nothing - the next render recomputes
    // the true figure. Counting ticks instead would quietly lose every minute the
    // screen was not on top, which is most of a workout.
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    const elapsedSeconds = elapsedSecondsBetween(session?.startedAt?.toMillis?.(), now)

    // What *this* Client should be aiming for, opened for performing.
    //
    // The Version says what the workout is; their Assignment says what the
    // numbers are for them, so two Clients on one Template see two different
    // sets of targets. Every part of that judgement lives in utils/prescription
    // and none of it may creep out here: ADR 0004's rule is subtle enough that a
    // second implementation would drift from the first.
    //
    // Waiting on `assignmentLoading` is what keeps the answer *theirs*. The plan
    // is applied once and never re-applied, so resolving before the Assignment
    // has answered would prefill the shared Template's loads and then have no
    // way to correct them. This is not the wait the offline rewrite removed:
    // that one blocked on the Version and left the form permanently unhydrated
    // when it never came. Here the read finishes either way - the Assignment
    // arrives, or its own timeout releases the gate and the Client gets the
    // Template's targets with the offline banner up, which beats no plan at all.
    // A null Assignment is an answer too, and the right one for a Template a
    // Client wrote themselves - there is no Assignment document for one, so that
    // read is refused by the rules rather than answering empty, which the
    // snapshot helper reports as an error and not as offline. Either way the
    // gate releases and the Template's own targets are the Client's own.
    //
    // Held as the resolved targets rather than only as drafts, because the same
    // answer is what the Session is judged against at completion. Comparing
    // against anything else - the raw Version, or the drafts after the Client
    // has typed into them - would judge them against numbers they were not
    // asked for.
    const targets = useMemo(
        () => (version && !assignmentLoading ? resolveTargets(version, assignment) : null),
        [version, assignment, assignmentLoading]
    )
    const targetDrafts = useMemo(() => (targets ? draftsFromTargets(targets) : null), [targets])

    // Filling the form is a one-shot: the snapshot helper subscribes with
    // includeMetadataChanges, so the Session document arrives more than once with
    // identical contents, and re-prefilling on the second delivery would wipe
    // everything the Client had ticked since the first.
    //
    // It happens as soon as the Session document is here, and deliberately does
    // not wait for the Template Version. In a gym basement that read may time
    // out, or answer in thirty seconds, or never answer at all, and a Client
    // standing in front of a barbell has to be able to record what they are
    // doing either way - the Session already carries `templateName`, denormalised
    // for exactly this, so the screen still says which workout this is. Waiting
    // instead would leave the form open but permanently unhydrated, which is how
    // this screen used to both block itself and then wipe whatever had been
    // typed in the meantime when the Version finally landed.
    useEffect(() => {
        if (hydrated || !session) return

        // Coming back to a Session already in flight - a swipe back to the
        // workout list and a tap on Resume - picks the ticks up where they were,
        // including whether the plan had made it in.
        const draft = getLiveSessionDraft(sessionId)
        if (draft) {
            setExercises(draft.exercises)
            setPlanApplied(draft.planApplied)
            setHydrated(true)
            return
        }

        // A Self-Directed Session has no plan to prefill: the Client builds it as
        // they go, starting from nothing. There is nothing to wait for, so it is
        // "applied" the moment it opens.
        if (!session.templateId) {
            setPlanApplied(true)
            setHydrated(true)
            return
        }

        if (targetDrafts) {
            setExercises(targetDrafts)
            setPlanApplied(true)
        }

        setHydrated(true)
    }, [session, targetDrafts, sessionId, hydrated])

    // The plan arriving late adds to the Session; it never replaces it.
    //
    // Appended below whatever the Client has already done, rather than inserted
    // in plan order, so nothing moves under a finger mid-workout. An Exercise
    // they had already added by hand is matched by id and left alone - it keeps
    // the Sets they recorded rather than being handed the prescribed ones, since
    // what they did is the fact and the target is only the intention.
    useEffect(() => {
        if (!hydrated || planApplied || !targetDrafts) return

        setExercises((prev) => {
            const present = new Set(prev.map((ex) => ex.exerciseId))
            return [...prev, ...targetDrafts.filter((ex) => !present.has(ex.exerciseId))]
        })
        setPlanApplied(true)
    }, [hydrated, planApplied, targetDrafts])

    // Held outside the component so a back-swipe to the workout list doesn't lose
    // half a workout's ticks. Memory only, and deliberately so - see
    // utils/liveSessionDraft.
    useEffect(() => {
        if (hydrated && sessionId) saveLiveSessionDraft(sessionId, exercises, planApplied)
    }, [exercises, planApplied, hydrated, sessionId])

    const handlePickExercise = (exercise) => {
        setPickerOpen(false)
        pickExercise(exercise)
    }

    // The one Set-level change that is this screen's alone: ticking is the
    // claim that a Set happened, and nothing else here has anything to tick.
    const toggleSet = (exIndex, setIndex) =>
        setExercises((prev) =>
            prev.map((ex, i) =>
                i === exIndex
                    ? { ...ex, checked: ex.checked.map((c, j) => (j === setIndex ? !c : c)) }
                    : ex
            )
        )

    const totalChecked = exercises.reduce((total, ex) => total + checkedCount(ex), 0)
    const totalSets = exercises.reduce((total, ex) => total + ex.sets.length, 0)

    const openFinish = () => {
        setError('')
        setDurationMinutes(String(minutesFromSeconds(elapsedSeconds)))
        // The day it started, not the day it ends. A Session begun at 23:50 was
        // Tuesday's training however long it ran.
        setDate(toDateInput(session?.startedAt?.toDate?.() ?? new Date()))
        setFinishing(true)
    }

    const handleFinish = async () => {
        setError('')

        const performed = exercises
            .map((ex) => ({
                exerciseId: ex.exerciseId,
                name: ex.name,
                fields: ex.fields,
                // Only what was ticked. Every prescribed row arrives already
                // filled in with its target, so storing an unticked one would
                // record work nobody did - the tick is the claim that it
                // happened. hasMeasurement then drops a row ticked while still
                // blank, because a Set with no measurement at all is not a Set.
                sets: ex.sets
                    .filter((_, i) => ex.checked[i])
                    .map((set) => storedSetFrom(set, ex.fields))
                    .filter(hasMeasurement),
            }))
            .filter((ex) => ex.sets.length > 0)

        if (performed.length === 0) {
            setError('Check off at least one set before finishing.')
            return
        }

        const parsedDate = parseDateInput(date)
        if (!parsedDate) {
            setError('Enter a valid date (YYYY-MM-DD).')
            return
        }

        // The same standard as the date beside it. A box the Client cleared
        // saves as null - the duration wasn't recorded - rather than being
        // coerced to a 0-minute workout, which is a fact about training that
        // never happened.
        const parsedDuration = parseDurationInput(durationMinutes)
        if (parsedDuration === undefined) {
            setError('Enter a duration in minutes, or leave it blank.')
            return
        }

        setSaving(true)
        try {
            await completeSession({
                sessionId,
                exercises: performed,
                durationMinutes: parsedDuration,
                notes: notes.trim(),
                date: parsedDate,
                // Judged once, here, and never again (ADR 0002). `targets` is
                // null for a Self-Directed Session and for a prescribed one
                // whose Version never reached the phone; the comparison is then
                // null too and no verdict is written, because there was nothing
                // to compare against rather than nothing to say.
                comparison: compareSession(performed, targets),
            })
            clearLiveSessionDraft(sessionId)
            // Replace, so the back gesture returns to the workout list rather
            // than to a live screen for a Session that is over. `saving` is
            // deliberately left true: the snapshot echoes the completed status
            // before navigation lands, and the guard below would otherwise flash
            // the finished state on the way out.
            router.replace(`/workouts/${sessionId}`)
        } catch (err) {
            setError(err.message || 'Failed to save this session.')
            setSaving(false)
        }
    }

    if (!session) {
        return (
            <ThemedView style={styles.container}>
                <OfflineBanner visible={offline} onRetry={retry} />
                <ThemedText>
                    {sessionLoading ? 'Loading...' : 'This session is no longer here. It may have been discarded.'}
                </ThemedText>
            </ThemedView>
        )
    }

    // Reached by a stale link, a back-navigation into a Session finished on
    // another device, or the Client's own history. Nothing here is editable
    // afterwards, so send them to the record rather than reopening the workout.
    if (!isActiveSession(session) && !saving) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>This session is finished.</ThemedText>
                <Spacer height={16} />
                <ThemedButton onPress={() => router.replace(`/workouts/${sessionId}`)}>
                    <ThemedText variant="body" tone="onPrimary" style={styles.primaryBtnText}>View session</ThemedText>
                </ThemedButton>
            </ThemedView>
        )
    }

    // The eyebrow says what this Session is, in place of the separate title +
    // "Version N · in progress" subtitle the native header used to draw - this
    // screen has no native header any more (see workouts/_layout.tsx) to
    // repeat it under.
    const eyebrow = [
        (session.templateName || 'Session without a plan').toUpperCase(),
        version?.versionNumber ? `V${version.versionNumber}` : null,
    ]
        .filter(Boolean)
        .join(' · ')

    return (
        <ThemedView style={styles.container}>
            {/* Outside the ScrollView on purpose: the clock is the one thing that
                must stay visible however far down the workout the Client is. */}
            <View
                style={[
                    styles.header,
                    { paddingTop: insets.top + Space.sm, borderBottomColor: theme.line, backgroundColor: theme.background },
                ]}
            >
                <View style={styles.headerTop}>
                    <View style={styles.headerEyebrowWrap}>
                        <ThemedText variant="label" tone="faint" numberOfLines={1}>
                            {eyebrow}
                        </ThemedText>
                        <View style={styles.clockRow}>
                            <View style={[styles.dot, { backgroundColor: theme.iconColorFocused }]} />
                            <ThemedText variant="display" tone="title" style={styles.tabular}>
                                {formatElapsed(elapsedSeconds)}
                            </ThemedText>
                        </View>
                    </View>
                    {/* The artboard puts a Pause pill here and there deliberately
                        isn't one. Elapsed is always (now - startedAt), so pausing
                        would have to persist how long the Session spent stopped -
                        a new field on the document, which is a domain change and
                        not a visual one. A pill that looks tappable and does
                        nothing is worse than no pill, so it waits for the field. */}
                </View>

                <View style={styles.progressRow}>
                    <ProgressBar value={totalSets > 0 ? totalChecked / totalSets : 0} style={styles.progressBar} />
                    <ThemedText variant="small" tone="muted" style={styles.progressLabel}>
                        <ThemedText variant="small" tone="title" style={[styles.tabular, styles.numeralFont]}>
                            {totalChecked}
                        </ThemedText>{' '}
                        of {totalSets} sets
                    </ThemedText>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + Space.xxl * 2 },
                ]}
                keyboardShouldPersistTaps="handled"
            >
                <OfflineBanner visible={offline} onRetry={retry} />

                {/* Three states, and the middle one is the whole point: the plan
                    has not arrived, the Client is training anyway, and they are
                    told so rather than left looking at an empty screen. Nothing
                    below is disabled while it says this - what they record here
                    is kept, and the targets slot in underneath if the Version
                    reaches the phone later. */}
                {!planApplied ? (
                    <ThemedText variant="meta" tone="muted" style={styles.hint}>
                        {/* `hydrated` is in the test because the Version read
                            reports "not loading" for the frame before it starts:
                            its ref is null until the Session document names a
                            Template, so without this the wording would flash the
                            failure copy on the way to the normal path. */}
                        {!hydrated || versionLoading || assignmentLoading
                            ? 'Loading your workout...'
                            : "This workout's plan hasn't reached your phone. Add what you do — it's all kept, and the plan fills in below if it arrives."}
                    </ThemedText>
                ) : exercises.length === 0 ? (
                    <ThemedText variant="meta" tone="muted" style={styles.hint}>
                        Nothing here yet. Add an exercise as you do it — the timer is already running.
                    </ThemedText>
                ) : null}

                {exercises.map((exercise, exIndex) => (
                    <View key={`${exercise.exerciseId}-${exIndex}`}>
                        <Spacer height={Space.xxl} />
                        <ExerciseSetEditor
                            name={exercise.name}
                            fields={exercise.fields}
                            sets={exercise.sets}
                            hint={exercise.target}
                            progress={{ done: checkedCount(exercise), total: exercise.sets.length }}
                            checked={exercise.checked}
                            targets={exercise.targetSets}
                            editable={!saving}
                            onToggleSet={(setIndex) => toggleSet(exIndex, setIndex)}
                            onChangeSet={(setIndex, field, value) => updateSet(exIndex, setIndex, field, value)}
                            onAddSet={() => addSet(exIndex)}
                            onRemoveExercise={() => skipExercise(exIndex)}
                        />
                    </View>
                ))}

                {/* Not in the reference artboards, which only frame the fixed
                    prescribed Exercises - but adding one mid-workout is real
                    functionality (a Self-Directed Session has no other way to
                    start), so it keeps a place here, styled the same as the
                    pills under each Exercise. */}
                <Spacer height={Space.lg} />
                <Pressable
                    onPress={() => setPickerOpen(true)}
                    disabled={saving}
                    style={[styles.addExercisePill, { backgroundColor: theme.uiBackground, borderColor: theme.line }]}
                >
                    <Ionicons name="add" size={14} color={theme.text} />
                    <ThemedText variant="small" tone="body">Add exercise</ThemedText>
                </Pressable>

                {error ? (
                    <>
                        <Spacer height={16} />
                        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
                    </>
                ) : null}

                {finishing ? (
                    <>
                        <Spacer height={Space.xl} />
                        <ThemedCard raised>
                            <ThemedText variant="cardTitle" tone="title">
                                Finish session
                            </ThemedText>

                            <Spacer height={16} />
                            <ThemedText variant="meta" tone="muted" style={styles.label}>Duration (minutes)</ThemedText>
                            {/* Defaulted from the timer and editable, because a phone
                                left running through lunch should not ruin the record. */}
                            <ThemedTextInput
                                value={durationMinutes}
                                onChangeText={setDurationMinutes}
                                keyboardType="numeric"
                                editable={!saving}
                            />

                            <Spacer height={16} />
                            <ThemedText variant="meta" tone="muted" style={styles.label}>Counts for</ThemedText>
                            <ThemedTextInput
                                value={date}
                                onChangeText={setDate}
                                placeholder="YYYY-MM-DD"
                                editable={!saving}
                            />

                            <Spacer height={16} />
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

                            <Spacer height={16} />
                            {/* Said plainly before the button, not discovered
                                afterwards: prefilled targets mean every row looks
                                complete, and only the ticks say what was actually
                                performed. */}
                            <ThemedText variant="meta" tone="muted">
                                Saving the {totalChecked} set{totalChecked === 1 ? '' : 's'} you checked off. Anything
                                left unchecked isn&apos;t recorded.
                            </ThemedText>

                            <Spacer height={16} />
                            <ThemedButton onPress={handleFinish} disabled={saving}>
                                <ThemedText variant="body" tone="onPrimary" style={styles.primaryBtnText}>
                                    {saving ? 'Saving...' : 'Save session'}
                                </ThemedText>
                            </ThemedButton>

                            <Spacer height={10} />
                            <ThemedButton
                                variant="ghost"
                                onPress={() => setFinishing(false)}
                                disabled={saving}
                            >
                                <ThemedText>Keep training</ThemedText>
                            </ThemedButton>
                        </ThemedCard>
                    </>
                ) : null}
                <Spacer height={20} />
            </ScrollView>

            {/* Fixed, like the header - a back button that simply leaves (the
                draft above already persists everything ticked so far) and the
                one answer this screen is for, naming what it will do rather
                than just "Finish". While `finishing` is open, FINISH re-opens
                that same form instead of a second, competing save path. */}
            <View
                style={[
                    styles.footer,
                    {
                        paddingBottom: insets.bottom + Space.md,
                        borderTopColor: theme.line,
                        backgroundColor: theme.navBackground,
                    },
                ]}
            >
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={4}
                    style={[styles.backButton, { backgroundColor: theme.uiBackground, borderColor: theme.line }]}
                >
                    <Ionicons name="arrow-back" size={20} color={theme.text} />
                </Pressable>
                <ThemedButton
                    style={styles.finishButton}
                    onPress={finishing ? handleFinish : openFinish}
                    disabled={saving}
                >
                    <ThemedText variant="label" tone="onPrimary">
                        {saving ? 'SAVING' : 'FINISH'}
                    </ThemedText>
                    <ThemedText variant="small" tone="onPrimary" style={styles.finishSubLabel}>
                        saves {totalChecked} of {totalSets} sets
                    </ThemedText>
                </ThemedButton>
            </View>

            <ExercisePicker
                visible={pickerOpen}
                onSelect={handlePickExercise}
                onClose={() => setPickerOpen(false)}
            />
        </ThemedView>
    )
}

export default LiveSession

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        borderBottomWidth: 1,
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: Space.md,
        gap: Space.md,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Space.sm,
    },
    headerEyebrowWrap: {
        gap: 2,
    },
    clockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md,
    },
    progressBar: {
        flex: 1,
    },
    progressLabel: {
        flexShrink: 0,
    },
    scrollContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: Space.lg,
    },
    hint: {
        marginBottom: Space.sm,
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
    label: {
        marginBottom: 6,
    },
    notesInput: {
        minHeight: 80,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    primaryBtnText: {
        fontWeight: 'bold',
    },
    footer: {
        borderTopWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md,
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: Space.md,
    },
    backButton: {
        width: 52,
        height: 52,
        borderRadius: Radius.pill,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    finishButton: {
        flex: 1,
        height: 52,
        padding: 0,
        gap: 1,
    },
    finishSubLabel: {
        opacity: 0.78,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    // TOKENS.md: Space Grotesk is "every heading, every number" - the header's
    // own set-count is a number sitting at a Plex-based size, so it borrows
    // the heading family the same way the row lead numbers do.
    numeralFont: {
        fontFamily: FontFamily.heading,
    },
})
