import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View, useColorScheme } from 'react-native'
import Pressable from './Touchable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Redirect, type Href } from 'expo-router'

import ThemedView from './ThemedView'
import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import ThemedButton from './ThemedButton'
import ThemedCard from './ThemedCard'
import Checkbox from './Checkbox'
import DateField from './DateField'
import FieldError from './FieldError'
import AddButton from './AddButton'
import OfflineBanner from './OfflineBanner'
import { PlaceholderRows } from './Placeholder'
import BackPill from './BackPill'
import FadeIn from './FadeIn'
import ProgressBar from './ProgressBar'
import Spacer from './Spacer'
import ExercisePicker from './ExercisePicker'
import ExerciseSetEditor from './ExerciseSetEditor'
import { Colors } from '../constants/Colors'
import { Radius, Space, SCREEN_PADDING } from '../constants/Layout'
import { STAGGER_MAX_MS, STAGGER_MS } from '../constants/Motion'
import { FontFamily } from '../constants/Type'
import { useAssignment } from '../hooks/useAssignments'
import { draftsFrom, useExerciseDraft } from '../hooks/useExerciseDraft'
import { useOffline } from '../hooks/useOffline'
import { completeSession, isActiveSession, useSession } from '../hooks/useSessions'
import {
    createWorkoutTemplate,
    suggestedTemplateName,
    templateExercisesFrom,
    useTemplateVersion,
} from '../hooks/useWorkoutTemplates'
import { toDateInput, parseDateInput, sessionDateError } from '../utils/dateInput'
import { compareSession, resolveTargets } from '../utils/prescription'
import {
    durationError,
    maskDurationInput,
    elapsedSecondsBetween,
    formatDurationInput,
    formatElapsed,
    minutesFromSeconds,
    parseDurationInput,
} from '../utils/elapsed'
import { targetSummary } from '../utils/formatSet'
import {
    clearLiveSessionDraft,
    getLiveSessionDraft,
    saveLiveSessionDraft,
} from '../utils/liveSessionDraft'
import { hasMeasurement, storedSetFrom } from '../utils/setDraft'

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
        target: targetSummary(targetExercises[index].sets),
        // The original prescribed values, held apart from `sets` - which
        // mutates as the Client edits and ticks - so a departed row can still
        // say what it was asked for after being typed over. Untouched by
        // addSet/removeSet, so a Set added past this length simply has no
        // entry here, which is what tells the editor there is nothing for it
        // to have departed from.
        targetSets: draft.sets,
    }))

const checkedCount = (exercise) => (exercise.checked ?? []).filter(Boolean).length

// What the Session records: only what was ticked. Every prescribed row arrives
// already filled in with its target, so storing an unticked one would record
// work nobody did - the tick is the claim that it happened. hasMeasurement then
// drops a row ticked while still blank, because a Set with no measurement at
// all is not a Set.
const performedFrom = (exercises) =>
    exercises
        .map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            fields: ex.fields,
            sets: ex.sets
                .filter((_, i) => ex.checked[i])
                .map((set) => storedSetFrom(set, ex.fields))
                .filter(hasMeasurement),
        }))
        .filter((ex) => ex.sets.length > 0)

type Props = {
    sessionId: string
    /** Leaving without finishing. Nothing is lost: the draft keeps every tick. */
    leave: () => void
    /** What the back arrow leaves to, for a screen reader - "Back to Today". */
    leaveLabel: string
    /** Where a saved Session goes: its summary, with a back arrow out of it. */
    openSummary: () => void
    /** Where a Session already finished sends anyone who wanders back in. */
    finishedHref: Href
    /** Whose Library a Template saved from this Session joins. */
    templateAuthorId: string
    /**
     * A Trainer running the Session for their Client. Changes one thing: a
     * Modified Session may be saved as a Template too, into the Trainer's own
     * Library, because a Trainer adjusting a workout on the floor is authoring.
     */
    trainerLed?: boolean
}

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
 *
 * Two routes draw it: a Client's own, pushed from Today, and a Trainer's,
 * pushed from that Client's page to run the Session with them. The Session is
 * the Client's either way - it carries their clientId and lands in their
 * history - so the routes differ only in where the screen leads.
 */
const LiveSession = ({
    sessionId,
    leave,
    leaveLabel,
    openSummary,
    finishedHref,
    templateAuthorId,
    trainerLed,
}: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const insets = useSafeAreaInsets()

    const { session, loading: sessionLoading, offline: sessionOffline, retry: retrySession } =
        useSession(sessionId)

    // Null for a Self-Directed Session, and the hook subscribes to nothing then.
    const { version, loading: versionLoading, offline: versionOffline, retry: retryVersion } =
        useTemplateVersion(session?.templateId, session?.versionId)
    // This Client's own target loads. Keyed off the Session's own clientId
    // rather than the signed-in profile: the Session names whose it is, which
    // is the Client's even when their Trainer is the one holding the phone.
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
    const [duration, setDuration] = useState('')
    const [date, setDate] = useState('')
    const [notes, setNotes] = useState('')
    // One slot per field, so each complaint is drawn under the box it is
    // about and every problem shows at once (see .claude/rules/ui.md).
    // `form` belongs to no field: nothing ticked, or the write itself failing.
    const [errors, setErrors] = useState<{ form?: string; duration?: string; date?: string; templateName?: string }>({})
    const clearError = (field: 'form' | 'duration' | 'date' | 'templateName') =>
        setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
    const [saving, setSaving] = useState(false)
    const scrollRef = useRef<ScrollView>(null)
    const durationRef = useRef<TextInput>(null)
    const dateRef = useRef<TextInput>(null)
    const templateNameRef = useRef<TextInput>(null)
    // Offered on a Self-Directed Session, and to a Trainer on a Modified one
    // (see `offerTemplate` below).
    const [saveAsTemplate, setSaveAsTemplate] = useState(false)
    const [templateName, setTemplateName] = useState('')

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

    // Swiping a Set away (see components/SwipeToDelete). Not the shared
    // `removeSet`: that keeps `sets` and `checked` in step, but this screen
    // hangs a third parallel array off each row - `targetSets`, what each Set
    // was prescribed - and dropping a Set without dropping its target would
    // slide every later row's target up one, marking on-target Sets as
    // departed. A prescribed Set deleted here is simply work not done; the
    // verdict at completion is judged against `targets`, not these rows, so it
    // still counts as a departure from the plan.
    const deleteSet = (exIndex, setIndex) => {
        const keep = (_, j) => j !== setIndex
        setExercises((prev) =>
            prev.map((ex, i) =>
                i === exIndex
                    ? {
                          ...ex,
                          sets: ex.sets.filter(keep),
                          checked: ex.checked.filter(keep),
                          ...(ex.targetSets ? { targetSets: ex.targetSets.filter(keep) } : null),
                      }
                    : ex
            )
        )
    }

    const totalChecked = exercises.reduce((total, ex) => total + checkedCount(ex), 0)
    const totalSets = exercises.reduce((total, ex) => total + ex.sets.length, 0)

    // Only a Session with no plan can become one. Read off the Session document
    // rather than off `targets`, which is also null when a prescribed Version
    // simply never reached the phone - offering to save that as a new Template
    // would let a dropped read quietly fork the Trainer's workout.
    const selfDirected = Boolean(session) && !session.templateId

    // A Client is never offered a Modified Session as a Template: theirs already
    // has one, and a second copy under their own name is how one workout becomes
    // two that drift apart. A Trainer is, because the Template it would fork is
    // their own and the fork lands in their own Library, beside it. Judged the
    // same way the verdict will be, and only while the finish card is open.
    const modified =
        Boolean(trainerLed && finishing && targets) &&
        compareSession(performedFrom(exercises), targets)?.verdict === 'modified'
    const offerTemplate = selfDirected || modified

    const openFinish = () => {
        setErrors({})
        setDuration(formatDurationInput(elapsedSeconds))
        // The day it started, not the day it ends. A Session begun at 23:50 was
        // Tuesday's training however long it ran.
        setDate(toDateInput(session?.startedAt?.toDate?.() ?? new Date()))
        // Named from what they actually did, and only once - reopening the card
        // must not overwrite a name they have already typed.
        setTemplateName((prev) => prev || suggestedTemplateName(exercises))
        setFinishing(true)
        // The card is added at the end of the scroll, under the fixed footer,
        // so without this FINISH looked like it had done nothing. Next frame,
        // once the card has laid out.
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    }

    const handleFinish = async () => {
        const performed = performedFrom(exercises)

        // Checked before the Session is written, not after: a Template needs a
        // name, and discovering that afterwards would mean the workout is
        // already saved and this screen has already navigated away from it.
        const wantsTemplate = offerTemplate && saveAsTemplate
        const trimmedTemplateName = templateName.trim()

        // Every problem at once, each under its own box, and the cursor put in
        // the first bad one. A cleared duration is fine: it saves as
        // unrecorded rather than as a workout that took no time.
        const found = {
            form: performed.length === 0 ? 'Tick at least one set before saving.' : undefined,
            duration: durationError(duration) ?? undefined,
            date: sessionDateError(date) ?? undefined,
            templateName:
                wantsTemplate && !trimmedTemplateName ? 'Name the template, or untick "Save this as a template".' : undefined,
        }
        setErrors(found)
        if (found.duration) return durationRef.current?.focus()
        if (found.date) return dateRef.current?.focus()
        if (found.templateName) return templateNameRef.current?.focus()
        if (found.form) return

        const parsedDate = parseDateInput(date)
        const parsedSeconds = parseDurationInput(duration)

        setSaving(true)
        try {
            await completeSession({
                sessionId,
                exercises: performed,
                // Seconds are what the box holds; the rounded minutes ride
                // along so readers that only know `durationMinutes` keep
                // working (see completeSession).
                durationSeconds: parsedSeconds,
                durationMinutes: parsedSeconds == null ? null : minutesFromSeconds(parsedSeconds),
                notes: notes.trim(),
                date: parsedDate,
                // Judged once, here, and never again (ADR 0002). `targets` is
                // null for a Self-Directed Session and for a prescribed one
                // whose Version never reached the phone; the comparison is then
                // null too and no verdict is written, because there was nothing
                // to compare against rather than nothing to say.
                comparison: compareSession(performed, targets),
            })

            // Second, and separately, because the two are not one operation.
            // The Session is the record and it is now safely written; the
            // Template is a convenience made out of it. A failure here - a
            // connection that dropped between the two writes - must not read as
            // "your workout wasn't saved", so it is reported on its own terms
            // and the Client is still taken to the Session that did save.
            //
            // Not a batch for the same reason it is not one in
            // createWorkoutTemplate: the version-create rule resolves its
            // parent Template with get(), which cannot see a sibling write.
            if (wantsTemplate) {
                try {
                    await createWorkoutTemplate({
                        authorId: templateAuthorId,
                        name: trimmedTemplateName,
                        exercises: templateExercisesFrom(performed),
                    })
                } catch (err) {
                    console.warn('[session] saved, but the template was not:', err)
                }
            }

            clearLiveSessionDraft(sessionId)
            // `saving` is deliberately left true: the snapshot echoes the
            // completed status before navigation lands, and the guard below
            // would otherwise flash the finished state on the way out.
            openSummary()
        } catch (err) {
            setErrors({ form: err.message || 'Failed to save this session.' })
            setSaving(false)
        }
    }

    if (!session) {
        return (
            <ThemedView style={styles.container}>
                <OfflineBanner visible={offline} onRetry={retry} />
                {sessionLoading ? (
                    <PlaceholderRows />
                ) : (
                    <>
                        <ThemedText>This session is no longer here. It may have been discarded.</ThemedText>
                        <Spacer height={16} />
                        <ThemedButton onPress={leave}>
                            <ThemedText variant="body" tone="onPrimary" style={styles.primaryBtnText}>{leaveLabel}</ThemedText>
                        </ThemedButton>
                    </>
                )}
            </ThemedView>
        )
    }

    // Reached by going back into a Session already finished - the browser's
    // or the phone's back gesture from its summary, which walks history
    // rather than the Stack - or by a stale link. It used to stop on a
    // "This session is finished" page; nothing here is editable afterwards,
    // so it goes straight on to History, where the record is. Declarative, as
    // the routing rule asks (.claude/rules/ui.md).
    if (!isActiveSession(session) && !saving) {
        return <Redirect href={finishedHref} />
    }

    // The eyebrow says what this Session is - this screen has no native header
    // (see workouts/_layout.tsx) to say it instead.
    const eyebrow = (session.templateName || 'Session without a plan').toUpperCase()

    return (
        <ThemedView style={styles.container}>
                {/* The workout arrives in the order it is read: the clock and the
                progress first, then the Exercises behind it (below), then the
                one button that ends it. Nothing here waits on the network -
                see startSession - so this is the whole of what tapping START
                looks like, and it wants to look deliberate rather than like a
                screen being replaced. */}
            <FadeIn rise={12}>
                {/* Outside the ScrollView on purpose: the clock is the one thing that
                    must stay visible however far down the workout the Client is. */}
                <View
                    style={[
                        styles.header,
                        { paddingTop: insets.top + Space.sm, borderBottomColor: theme.line, backgroundColor: theme.background },
                    ]}
                >
                    {/* The eyebrow sits over the clock, and the back arrow on the
                        clock's own line, level with its green dot - it used to
                        centre on eyebrow and clock together and float between
                        them. Top left, like every other screen's back arrow. */}
                    <View style={styles.headerTop}>
                        <ThemedText variant="label" tone="faint" numberOfLines={1} style={styles.eyebrow}>
                            {eyebrow}
                        </ThemedText>
                        <View style={styles.clockRow}>
                            <BackPill onPress={leave} label={leaveLabel} style={styles.back} />
                            <View style={[styles.dot, { backgroundColor: theme.iconColorFocused }]} />
                            <ThemedText variant="display" tone="title" style={styles.tabular}>
                                {formatElapsed(elapsedSeconds)}
                            </ThemedText>
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
            </FadeIn>

            <ScrollView
                ref={scrollRef}
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

                {/* Each Exercise lands a beat after the one above it, capped
                    so a long workout still appears at once (constants/Motion).
                    They arrive when the plan does, which is a moment after the
                    header either way - so the stagger costs nothing and the
                    screen reads top to bottom as it fills.

                    `removeLabel` is the one thing that differs between the two
                    kinds of row here: skipping is something only a prescribed
                    Exercise can be, so one the Client added mid-Session offers
                    to delete itself instead. */}
                {exercises.map((exercise, exIndex) => (
                    <FadeIn
                        key={`${exercise.exerciseId}-${exIndex}`}
                        delay={Math.min(exIndex * STAGGER_MS, STAGGER_MAX_MS)}
                    >
                        <Spacer height={Space.xxl} />
                        <ExerciseSetEditor
                            name={exercise.name}
                            fields={exercise.fields}
                            sets={exercise.sets}
                            hint={exercise.target}
                            progress={{ done: checkedCount(exercise), total: exercise.sets.length }}
                            checked={exercise.checked}
                            editable={!saving}
                            onToggleSet={(setIndex) => toggleSet(exIndex, setIndex)}
                            onChangeSet={(setIndex, field, value) => updateSet(exIndex, setIndex, field, value)}
                            onAddSet={() => addSet(exIndex)}
                            onRemoveSet={(setIndex) => deleteSet(exIndex, setIndex)}
                            removeLabel={exercise.targetSets ? 'Skip exercise' : 'Delete exercise'}
                            onRemoveExercise={() => skipExercise(exIndex)}
                        />
                    </FadeIn>
                ))}

                {/* Not in the reference artboards, which only frame the fixed
                    prescribed Exercises - but adding one mid-workout is real
                    functionality (a Self-Directed Session has no other way to
                    start), so it keeps a place here, styled the same as the
                    pills under each Exercise. */}
                <Spacer height={Space.lg} />
                <AddButton label="Add exercise" onPress={() => setPickerOpen(true)} disabled={saving} />

                {finishing ? (
                    <>
                        <Spacer height={Space.xl} />
                        <ThemedCard raised>
                            <ThemedText variant="cardTitle" tone="title">
                                Finish session
                            </ThemedText>

                            <Spacer height={16} />
                            <ThemedText variant="meta" tone="muted" style={styles.label}>Duration</ThemedText>
                            {/* Defaulted from the timer and editable, because a phone
                                left running through lunch should not ruin the record.
                                Filled in the clock's own mm:ss so the figure offered
                                here is character-for-character the one the Client has
                                been watching in the header. */}
                            <ThemedTextInput
                                ref={durationRef}
                                accessibilityLabel="Duration"
                                value={duration}
                                onChangeText={(text) => {
                                    setDuration(maskDurationInput(text))
                                    clearError('duration')
                                }}
                                placeholder="mm:ss"
                                keyboardType="number-pad"
                        inputMode="numeric"
                        autoComplete="off"
                                editable={!saving}
                            />
                            <FieldError>{errors.duration}</FieldError>

                            <Spacer height={16} />
                            {/* "Date", not "Counts for". The old label was
                                explaining a rule - that a Session begun at
                                23:50 counts for the day it started - and a
                                form label is the wrong place to teach one:
                                the box is prefilled correctly already, so
                                nobody has to know. */}
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

                            {/* See `offerTemplate`: a Client's answer to "do
                                that again" on a planned Session is to start it
                                again rather than to fork it. */}
                            {offerTemplate ? (
                                <>
                                    <Spacer height={16} />
                                    <View style={[styles.templateRow, { borderColor: theme.line }]}>
                                        <Checkbox
                                            value={saveAsTemplate}
                                            onPress={() => setSaveAsTemplate((prev) => !prev)}
                                            disabled={saving}
                                        />
                                        <Pressable
                                            onPress={() => setSaveAsTemplate((prev) => !prev)}
                                            disabled={saving}
                                            style={styles.templateLabel}
                                        >
                                            <ThemedText variant="body" tone="title">
                                                Save this as a template
                                            </ThemedText>
                                            <ThemedText variant="small" tone="muted">
                                                {trainerLed
                                                    ? 'Adds what was just done to your Library.'
                                                    : 'Keeps what you just did as a workout you can start again.'}
                                            </ThemedText>
                                        </Pressable>
                                    </View>

                                    {/* The name box appears only once the box is
                                        ticked. An always-visible field would
                                        read as required on a card whose whole
                                        job is saving the Session. */}
                                    {saveAsTemplate ? (
                                        <>
                                            <Spacer height={10} />
                                            <ThemedTextInput
                                                ref={templateNameRef}
                                                accessibilityLabel="Template name"
                                                value={templateName}
                                                onChangeText={(text) => {
                                                    setTemplateName(text)
                                                    clearError('templateName')
                                                }}
                                                placeholder="Name this workout"
                                                autoCapitalize="words"
                                                editable={!saving}
                                            />
                                            <FieldError>{errors.templateName}</FieldError>
                                        </>
                                    ) : null}
                                </>
                            ) : null}

                            <Spacer height={16} />
                            {/* Said plainly before the button, not discovered
                                afterwards: prefilled targets mean every row looks
                                complete, and only the ticks say what was actually
                                performed. */}
                            <ThemedText variant="meta" tone="muted">
                                Saving the {totalChecked} set{totalChecked === 1 ? '' : 's'} you checked off. Anything
                                left unchecked isn&apos;t recorded.
                            </ThemedText>

                            <FieldError>{errors.form}</FieldError>

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

            {/* Fixed, like the header, and arriving a beat behind it: the one
                answer this screen is for, naming what it will do rather than
                just "Finish". */}
            {/* Gone while the finish card is open: the card's own Save is the
                answer then, and two filled buttons doing one job made the
                screen ask the same question twice. */}
            {finishing ? null : (
            <FadeIn rise={12} delay={STAGGER_MS}>
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
                    <ThemedButton
                        style={styles.finishButton}
                        onPress={openFinish}
                        disabled={saving}
                    >
                        <ThemedText variant="cardTitle" tone="onPrimary">
                            {saving ? 'Saving...' : 'Finish'}
                        </ThemedText>
                        <ThemedText variant="small" tone="onPrimary" style={styles.finishSubLabel}>
                            saves {totalChecked} of {totalSets} sets
                        </ThemedText>
                    </ThemedButton>
                </View>
            </FadeIn>
            )}

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
        gap: 0,
    },
    // Starts where the dot does: past the back arrow's 48px, less the 12px
    // the arrow is pulled into the screen margin.
    eyebrow: {
        marginLeft: 40,
    },
    back: {
        marginLeft: -12,
        marginRight: -4,
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
    templateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md,
        borderTopWidth: 1,
        paddingTop: Space.md,
    },
    // The label is a tap target too - a 30px circle is a small thing to aim
    // for mid-workout, and the words beside it are the obvious second one.
    templateLabel: {
        flex: 1,
        gap: 2,
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
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: Space.md,
    },
    finishButton: {
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
