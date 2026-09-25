import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native'
import Pressable from '../../components/Touchable'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc } from 'firebase/firestore'

import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedCard from '../../components/ThemedCard'
import ThemedButton from '../../components/ThemedButton'
import ThemedChip from '../../components/ThemedChip'
import ProgressSegments from '../../components/ProgressSegments'
import SectionLabel from '../../components/SectionLabel'
import OfflineBanner from '../../components/OfflineBanner'
import ActiveSessionBanner from '../../components/ActiveSessionBanner'
import PrescribedWorkoutList from '../../components/PrescribedWorkoutList'
import SelfAuthoredWorkoutList from '../../components/SelfAuthoredWorkoutList'
import SomethingElseSheet from '../../components/SomethingElseSheet'
import Spacer from '../../components/Spacer'
import { PlaceholderInline, PlaceholderRows } from '../../components/Placeholder'
import { Colors } from '../../constants/Colors'
import { Radius, SCREEN_PADDING, Space } from '../../constants/Layout'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestoreDoc } from '../../hooks/useFirestoreSnapshot'
import { useOffline } from '../../hooks/useOffline'
import { FROM_TODAY } from '../../hooks/useLeave'
import { discardSession, startSession, useSessions } from '../../hooks/useSessions'
import { useClientAssignments } from '../../hooks/useAssignments'
import { useWorkoutTemplate, useWorkoutTemplates } from '../../hooks/useWorkoutTemplates'
import { clearLiveSessionDraft } from '../../utils/liveSessionDraft'
import { sessionsThisWeek } from '../../utils/workoutStats'

/**
 * A Trainer's name with the honorific in front of it, said once.
 *
 * "PT" is ours to add, not theirs to type - but nothing stops a Trainer typing
 * it anyway, and the seeded fixture accounts are literally named "PT Zephyr"
 * and "PT Patrick", so prefixing unconditionally rendered "PT PT Patrick" in
 * both places this screen names them. Adding the prefix only when it isn't
 * already there fixes those without asking anyone to rename an account, and
 * keeps working for a Trainer who signs up as plain "Patrick".
 *
 * Deliberately narrow: it matches the honorific alone at the start of the
 * name, with or without dots, and leaves everything else alone. A Trainer
 * genuinely called "Pat" keeps their name.
 */
const PT_PREFIX = /^p\.?\s*t\.?\s+/i

const trainerLabel = (name?: string | null): string | null =>
    name ? `PT ${name.replace(PT_PREFIX, '')}` : null

/**
 * The raised hero: whichever Assignment is furthest behind its Target
 * Frequency this week, expressed as a ratio of done-to-target and nothing
 * else. Ordering only - nothing here is ever "overdue" (ADR 0001), so a
 * Client on day one of the week sees the same ordering logic as a Client on
 * day six, just with smaller numbers feeding it.
 *
 * Resolves its own Template, exactly as PrescribedWorkoutList's row does and
 * for the same reason: the Assignment names a Template but says nothing
 * about it, and starting has to hand back the whole loaded Template so the
 * Session can cite its current Version (ADR 0002).
 */
const HeroCard = ({
    assignment,
    doneThisWeek,
    fromLabel,
    onStart,
    disabled,
}: {
    assignment: any
    doneThisWeek: number
    fromLabel?: string | null
    onStart: (template: any) => void
    disabled?: boolean
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { template, loading } = useWorkoutTemplate(assignment.templateId)

    if (!template) {
        if (loading) return <PlaceholderRows count={1} raised={true} />
        return (
            <ThemedCard raised={true} style={styles.hero}>
                <ThemedText variant="body" tone="muted">
                    This workout isn&apos;t available right now.
                </ThemedText>
            </ThemedCard>
        )
    }

    const exerciseCount = template.currentVersionExerciseCount
    const startable = Boolean(template.currentVersionId) && !disabled
    const target = assignment.timesPerWeek ?? 1
    const done = Math.min(doneThisWeek, target)

    return (
        <ThemedCard raised={true} style={styles.hero}>
            <View style={styles.heroTop}>
                <View style={styles.heroEyebrowRow}>
                    <ThemedText variant="label" tone="accent">
                        UP NEXT
                    </ThemedText>
                    <ThemedChip label={`v${template.currentVersionNumber ?? 1}`} uppercase={false} />
                </View>
                <ThemedText variant="display" tone="title" numberOfLines={2}>
                    {template.name}
                </ThemedText>
                <ThemedText variant="meta" tone="body">
                    {[
                        // Absent rather than zero, as everywhere else this count
                        // is shown: a Template authored before it was recorded
                        // gets no clause instead of a false "0 exercises".
                        exerciseCount ? `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}` : null,
                        fromLabel ? `from ${fromLabel}` : null,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </ThemedText>
            </View>

            <View style={styles.heroWeek}>
                <View style={styles.heroWeekRow}>
                    <SectionLabel>THIS WEEK</SectionLabel>
                    <ThemedText variant="small" tone="body">
                        <ThemedText variant="cardTitle" tone="title" style={styles.tabular}>
                            {doneThisWeek}
                        </ThemedText>{' '}
                        of {target}
                    </ThemedText>
                </View>
                <ProgressSegments total={target} filled={done} />
            </View>

            <ThemedButton variant="primary" onPress={() => onStart(template)} disabled={!startable}>
                <View style={styles.startRow}>
                    <Ionicons name="play" size={16} color={theme.onPrimary} />
                    <ThemedText variant="cardTitle" tone="onPrimary" style={styles.startLabel}>
                        START
                    </ThemedText>
                </View>
            </ThemedButton>
        </ThemedCard>
    )
}

// Pushing a Session drops any other Session route from the Workouts Stack.
// The live screen's own back button already removes itself (see leave() in
// workouts/session/[sessionId].tsx), but a browser's back button goes around it,
// and a stranded route under the next Session is how back ended up on "no
// longer here". Singular by name rather than by id: two Sessions are never both
// worth keeping.
const SINGLE_SESSION_ROUTE = { dangerouslySingular: (name: string) => name }

/**
 * Today - the Client's landing tab, and the one place Signal draws a hero.
 *
 * Everything a Client can do with a workout starts here now: the prescribed
 * list, their own saved Templates, resuming or discarding a Session left
 * open, and the "something else" paths workouts/index.tsx used to hold as
 * three ghost buttons. That screen (now History) kept only what it is left
 * with once starting moves out - a Client's finished Sessions.
 */
const Today = () => {
    const { profile, offline: authOffline, signOut } = useAuth()
    const router = useRouter()
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const insets = useSafeAreaInsets()

    const {
        sessions,
        activeSession,
        offline: sessionsOffline,
        retry: retrySessions,
    } = useSessions(profile?.uid)
    const {
        assignments,
        loading: assignmentsLoading,
        offline: assignmentsOffline,
        retry: retryAssignments,
    } = useClientAssignments(profile?.uid)
    // The Client's own saved routines. Keyed on the signed-in uid, which is all
    // authorship is - the same hook serves a Trainer's Templates unchanged, and
    // nothing here asks about a role.
    const {
        templates: ownTemplates,
        loading: templatesLoading,
        offline: templatesOffline,
        retry: retryTemplates,
    } = useWorkoutTemplates(profile?.uid)
    const {
        data: trainer,
        loading: trainerLoading,
        offline: trainerOffline,
        retry: retryTrainer,
    } = useFirestoreDoc(
        () =>
            profile?.role === 'client' && profile?.trainerId ? doc(db, 'users', profile.trainerId) : null,
        [profile?.role, profile?.trainerId]
    )
    const offline = useOffline(sessionsOffline, assignmentsOffline, templatesOffline, trainerOffline)

    // Progress against each prescribed workout's Target Frequency, counted from
    // Sessions already on screen rather than by asking Firestore anything. The
    // window is `sessionsThisWeek`'s - the trailing seven days - so this and the
    // Trainer's review of the same Client cannot mean different weeks.
    const doneThisWeek = sessionsThisWeek(sessions).reduce((counts, session) => {
        if (session.templateId) counts[session.templateId] = (counts[session.templateId] ?? 0) + 1
        return counts
    }, {})

    // Furthest behind first: the ratio of what's done to what's asked, not a
    // due date - there is no such thing (ADR 0001). Ties keep the Assignments'
    // own order, which is newest-assigned-first from the hook.
    const orderedAssignments = [...assignments].sort((a, b) => {
        const ratio = (assignment) => (doneThisWeek[assignment.templateId] ?? 0) / (assignment.timesPerWeek || 1)
        return ratio(a) - ratio(b)
    })
    const heroAssignment = orderedAssignments[0]
    const remainingAssignments = orderedAssignments.slice(1)

    const trainerName = trainer?.name
    // Only ever named once it is actually known - the offline wording is not a
    // name, and dressing it up as "PT Unavailable" would read as a very oddly
    // named trainer rather than an unknown one. While loading, the pill holds
    // a placeholder instead of any words at all (see the header below).
    const trainerPillLabel = trainerLabel(trainerName) ?? (trainerOffline ? 'Unavailable offline' : 'Your trainer')
    const heroFromLabel = trainerLabel(trainerName)

    const [starting, setStarting] = useState(false)
    const [discarding, setDiscarding] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [error, setError] = useState('')

    // Any of the four can be the one that failed and the banner offers one
    // button, so retry means retry all of them.
    const retry = () => {
        retrySessions()
        retryAssignments()
        retryTemplates()
        retryTrainer()
    }

    // The single-active-Session rule, and the whole of its enforcement: Firestore
    // rules cannot run a query, so this is a product rule held in the UI rather
    // than a security one (ADR 0003). Two open at once grants access to nothing;
    // it just fragments one workout across two half-finished records.
    const blocked = Boolean(activeSession) || starting

    const open = async (start: () => Promise<string>) => {
        if (blocked) return
        setError('')
        setStarting(true)
        try {
            const sessionId = await start()
            router.push(`/workouts/session/${sessionId}`, SINGLE_SESSION_ROUTE)
            // Left true on the way out, and cleared on the way back in (below).
            // The new Session's snapshot lands here before the live screen has
            // finished arriving, and `starting` is what holds its banner back:
            // otherwise "SESSION IN PROGRESS" appeared on this screen, under
            // the entrance, announcing a workout the Client can already see.
            return
        } catch (err) {
            setError(err.message || 'Could not start this session.')
        }
        setStarting(false)
    }

    // Back on Today - having left the Session or finished it - the banner is
    // wanted again, and says whichever of the two is true.
    useFocusEffect(useCallback(() => setStarting(false), []))

    // The Template's current Version is captured here, at the moment of
    // starting, and travels with the Session for the rest of its life (ADR
    // 0002). A progression published mid-workout does not move the goalposts on
    // a Client already training.
    const startPrescribed = (template) =>
        open(() =>
            startSession({
                clientId: profile.uid,
                templateId: template.id,
                versionId: template.currentVersionId,
                templateName: template.name,
            })
        )

    // A Client's own Template starts exactly as a prescribed one does, through
    // the same call with the same three fields. It is not Self-Directed - there
    // was a plan and they wrote it - so the Session cites its Version and earns
    // a verdict like any other.
    const startOwn = startPrescribed

    // A Self-Directed Session carries no Template fields at all - not empty ones.
    const startSelfDirected = () => open(() => startSession({ clientId: profile.uid }))

    const handleDiscard = async () => {
        setError('')
        setDiscarding(true)
        try {
            clearLiveSessionDraft(activeSession.id)
            await discardSession(activeSession.id)
        } catch (err) {
            setError(err.message || 'Could not discard that session.')
        }
        setDiscarding(false)
    }

    if (!profile) {
        // Reaching this screen with no profile used to mean one thing; now that
        // the auth gate times out rather than spinning forever, it also means
        // "we never heard back". Telling an offline client to sign out and back
        // in is the worst possible advice - signing out is the one action they
        // cannot undo without a connection - so the two cases must read
        // differently, and the offline one must not offer the button.
        return (
            <ThemedView style={styles.noProfile}>
                <ThemedText variant="body" tone="body">
                    {authOffline
                        ? "Can't reach the server, so we couldn't load your profile. Check your connection - this screen will fill in on its own once you're back."
                        : "We couldn't load your profile. Try signing out and back in."}
                </ThemedText>
                {!authOffline && (
                    <>
                        <Spacer height={Space.xl} />
                        <ThemedButton onPress={signOut}>
                            <ThemedText variant="cardTitle" tone="onPrimary">
                                Sign Out
                            </ThemedText>
                        </ThemedButton>
                    </>
                )}
            </ThemedView>
        )
    }

    // Today is a Client's tab - the tab bar already hides it from a Trainer
    // (href: null in app/(tabs)/_layout.tsx) - but a direct link still has to
    // land somewhere sane rather than render a Client screen at a Trainer.
    if (profile.role === 'trainer') {
        return <Redirect href="/clients" />
    }

    const eyebrowDate = (() => {
        const now = new Date()
        const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
        const month = now.toLocaleDateString('en-US', { month: 'short' })
        return `${weekday} ${now.getDate()} ${month}`.toUpperCase()
    })()

    return (
        <ThemedView style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + Space.md }]}>
                <View>
                    <ThemedText variant="label" tone="faint">
                        {eyebrowDate}
                    </ThemedText>
                    <ThemedText variant="title" tone="title">
                        Today
                    </ThemedText>
                </View>
                <View
                    style={[
                        styles.trainerPill,
                        {
                            borderColor: theme.line,
                            backgroundColor: colorScheme === 'light' ? theme.uiBackground : 'transparent',
                        },
                    ]}
                >
                    <View style={[styles.dot, { backgroundColor: theme.iconColorFocused }]} />
                    {trainerLoading ? (
                        <PlaceholderInline width={64} />
                    ) : (
                        <ThemedText variant="small" tone="body">
                            {trainerPillLabel}
                        </ThemedText>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {/* Above everything, including the offline notice: a Session
                    left open blocks starting anything else, so it is the
                    first thing that needs answering. Keyed by the Session so
                    a half-made "Discard?" belongs to the one it was asked
                    about - without it, the next Session started after a
                    discard arrived already asking to be discarded. */}
                <ActiveSessionBanner
                    key={activeSession?.id}
                    session={starting ? null : activeSession}
                    onResume={() => router.push(`/workouts/session/${activeSession.id}`, SINGLE_SESSION_ROUTE)}
                    onDiscard={handleDiscard}
                    discarding={discarding}
                />
                <OfflineBanner visible={offline} onRetry={retry} />

                {/* One placeholder for the whole plan while it is out, so
                    the rows below it - and the "Start, log or plan a workout"
                    row under them - don't arrive one at a time and push each
                    other down the screen. */}
                {assignmentsLoading || (templatesLoading && !heroAssignment) ? <PlaceholderRows count={1} raised={true} /> : null}

                {heroAssignment ? (
                    <HeroCard
                        assignment={heroAssignment}
                        doneThisWeek={doneThisWeek[heroAssignment.templateId] ?? 0}
                        fromLabel={heroFromLabel}
                        onStart={startPrescribed}
                        disabled={blocked}
                    />
                ) : null}

                <PrescribedWorkoutList
                    assignments={remainingAssignments}
                    onStart={startPrescribed}
                    doneThisWeek={doneThisWeek}
                    disabled={blocked}
                />

                <SelfAuthoredWorkoutList
                    templates={ownTemplates}
                    onStart={startOwn}
                    onEdit={(template) =>
                        router.push({
                            pathname: '/workouts/templates/[templateId]',
                            params: { templateId: template.id, from: FROM_TODAY },
                        })
                    }
                    disabled={blocked}
                />

                <Pressable
                    onPress={() => setSheetOpen(true)}
                    style={[styles.somethingElse, { borderColor: theme.lineSoft }]}
                >
                    <Ionicons name="add" size={15} color={theme.iconColor} />
                    <ThemedText variant="body" tone="muted">
                        Start, log or plan a workout
                    </ThemedText>
                </Pressable>

                {error ? (
                    <ThemedText variant="meta" tone="danger">
                        {error}
                    </ThemedText>
                ) : null}
            </ScrollView>

            <SomethingElseSheet
                visible={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onStartWithoutPlan={startSelfDirected}
                onLogPastWorkout={() => router.push({ pathname: '/workouts/new', params: { from: FROM_TODAY } })}
                onSaveOwnWorkout={() => router.push({ pathname: '/workouts/templates/new', params: { from: FROM_TODAY } })}
                startDisabled={blocked}
            />
        </ThemedView>
    )
}

export default Today

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    noProfile: {
        flex: 1,
        padding: SCREEN_PADDING,
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: Space.lg,
        gap: Space.sm,
    },
    trainerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Space.md,
        paddingVertical: Space.xs + 2,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    body: {
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: Space.xxl,
        gap: Space.md,
    },
    hero: {
        padding: Space.xl,
        gap: Space.lg,
    },
    heroTop: {
        gap: Space.sm,
    },
    heroEyebrowRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
    },
    heroWeek: {
        gap: Space.sm,
    },
    heroWeekRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    startRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.sm,
    },
    startLabel: {
        letterSpacing: 1.2,
    },
    somethingElse: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.sm,
        minHeight: 44,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: Radius.card,
    },
})
