import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { doc } from 'firebase/firestore'

import ThemedView from '../../../../components/ThemedView'
import ThemedText from '../../../../components/ThemedText'
import ThemedButton from '../../../../components/ThemedButton'
import WeeklyCompletionCard from '../../../../components/WeeklyCompletionCard'
import WorkoutListItem from '../../../../components/WorkoutListItem'
import SessionDiff from '../../../../components/SessionDiff'
import OfflineBanner from '../../../../components/OfflineBanner'
import SectionLabel from '../../../../components/SectionLabel'
import Spacer from '../../../../components/Spacer'
import { Colors } from '../../../../constants/Colors'
import { Radius, Space, SCREEN_PADDING } from '../../../../constants/Layout'
import { FontFamily } from '../../../../constants/Type'
import { db } from '../../../../firebase/config'
import { useAuth } from '../../../../contexts/AuthContext'
import { useSessions } from '../../../../hooks/useSessions'
import { useTrainerAssignments } from '../../../../hooks/useAssignments'
import { useWorkoutTemplates } from '../../../../hooks/useWorkoutTemplates'
import { useFirestoreDoc } from '../../../../hooks/useFirestoreSnapshot'
import { useOffline } from '../../../../hooks/useOffline'
import { deviations } from '../../../../utils/prescription'
import { weeklyCompletion } from '../../../../utils/weeklyCompletion'
import { sessionsThisWeek } from '../../../../utils/workoutStats'

// Progress media is out of scope while the core tracking loop is built (see
// CLAUDE.md, "Current scope"). A tab gates itself with `href: null`; an in-page link
// has no such affordance, so this flag stands in for one. The ./progress screen it
// points at, its hook and its rules are all untouched. Annotated `boolean` so the
// gated branch stays live code to the typechecker.
const PROGRESS_MEDIA_ENABLED: boolean = false

/**
 * Reviewing one Client.
 *
 * The screen the Trainer's half of the loop ends at. It draws its own header -
 * a circular back button, the Client's name, how much is prescribed to them -
 * the same reason Today and the live Session draw theirs (see
 * app/(tabs)/clients/[clientId]/_layout.tsx). Below it, one raised card says
 * how much of this week's expected work has happened; below that, every
 * Session says which workout it ran and how it went, and a Modified one opens
 * in place to the itemisation that justifies the verdict.
 *
 * Everything on it is a **read**. Sessions belong to the Client who performed
 * them - the rules grant a linked Trainer read-only access and nothing more -
 * so there is no control here that writes to one, and a Trainer who disagrees
 * with a record talks to their Client rather than editing it. That is not a
 * limitation to work around: a history a Trainer can quietly rewrite is not a
 * record.
 *
 * The verdict and the diff are both read straight off the Session, never
 * recomputed (ADR 0002). Recomputing would need the Version and the Assignment,
 * and an Assignment is mutable - so adjusting a Client's loads today would
 * change what last month's Session appeared to be asked for.
 */
const ClientDetail = () => {
    const { clientId } = useLocalSearchParams<{ clientId: string }>()
    const router = useRouter()
    const { profile } = useAuth()
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const insets = useSafeAreaInsets()

    const { sessions, loading, offline: sessionsOffline, retry: retrySessions } = useSessions(clientId)
    // Which Session's diff is open. Only a Modified Session has one to open -
    // see `expandable` below - so there is nothing to reconcile against a
    // Session whose row carries no such control.
    const [expandedId, setExpandedId] = useState(null)

    const {
        data: clientProfile,
        offline: profileOffline,
        retry: retryProfile,
    } = useFirestoreDoc(() => (clientId ? doc(db, 'users', clientId) : null), [clientId])

    // Every Assignment this Trainer has made, narrowed to this Client in memory.
    // The trainerId filter is not garnish - the read rule grants an Assignment to
    // its named Client or its owning Trainer, and rules are not filters, so a
    // query that constrains neither is rejected outright rather than trimmed.
    const {
        assignments: allAssignments,
        offline: assignmentsOffline,
        retry: retryAssignments,
    } = useTrainerAssignments(profile?.role === 'trainer' ? profile.uid : null)
    const assignments = useMemo(
        () => allAssignments.filter((assignment) => assignment.clientId === clientId),
        [allAssignments, clientId]
    )
    const activeAssignments = assignments.filter((a) => a.active !== false)
    const completion = weeklyCompletion(sessions, assignments)

    const {
        templates,
        offline: templatesOffline,
        retry: retryTemplates,
    } = useWorkoutTemplates(profile?.role === 'trainer' ? profile.uid : null)

    const doneThisWeekByTemplate = sessionsThisWeek(sessions).reduce((counts, session) => {
        if (session.templateId) counts[session.templateId] = (counts[session.templateId] ?? 0) + 1
        return counts
    }, {})

    // Named the same way the header figure sums them: each active Assignment's
    // workout and how much of it has happened, so a Trainer can see *which*
    // prescription is behind rather than only that the total is. Only drawn
    // once every name is on hand - a half-named breakdown would read as a
    // different roster than the one summed above it.
    const breakdown =
        activeAssignments.length > 0 &&
        activeAssignments.every((a) => templates.some((t) => t.id === a.templateId))
            ? activeAssignments.map((a) => ({
                  name: templates.find((t) => t.id === a.templateId).name,
                  done: doneThisWeekByTemplate[a.templateId] ?? 0,
                  target: a.timesPerWeek ?? 1,
              }))
            : undefined

    const offline = useOffline(sessionsOffline, profileOffline, assignmentsOffline, templatesOffline)
    const retry = () => {
        retrySessions()
        retryProfile()
        retryAssignments()
        retryTemplates()
    }

    return (
        <ThemedView style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + Space.md }]}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={4}
                    style={[styles.backButton, { backgroundColor: theme.uiBackground, borderColor: theme.line }]}
                >
                    <Ionicons name="chevron-back" size={17} color={theme.text} />
                </Pressable>
                <View style={styles.headerText}>
                    <ThemedText variant="title" tone="title" numberOfLines={1}>
                        {clientProfile?.name ?? 'Client'}
                    </ThemedText>
                    <ThemedText variant="small" tone="muted">
                        {activeAssignments.length} workout{activeAssignments.length === 1 ? '' : 's'} prescribed
                    </ThemedText>
                </View>
            </View>

            <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        <OfflineBanner visible={offline} onRetry={retry} />
                        {PROGRESS_MEDIA_ENABLED ? (
                            <>
                                <ThemedButton onPress={() => router.push(`/clients/${clientId}/progress`)}>
                                    <ThemedText variant="body" tone="onPrimary">
                                        View Progress Photos/Videos
                                    </ThemedText>
                                </ThemedButton>
                                <Spacer height={Space.lg} />
                            </>
                        ) : null}
                        <WeeklyCompletionCard completion={completion} breakdown={breakdown} />
                        <Spacer height={Space.lg} />
                        {!loading && sessions.length > 0 && (
                            <SectionLabel style={styles.historyLabel}>HISTORY</SectionLabel>
                        )}
                    </>
                }
                ItemSeparatorComponent={() => <Spacer height={Space.sm} />}
                ListEmptyComponent={
                    !loading && (
                        <ThemedText variant="body" tone="muted" style={styles.empty}>
                            This client hasn&apos;t logged any workouts yet.
                        </ThemedText>
                    )
                }
                renderItem={({ item }) => {
                    // Only a Modified Session has anything under it: SessionDiff
                    // itemises deviations and renders nothing for one that
                    // matched its plan exactly, so a row with no deviations gets
                    // no expand affordance rather than one that opens onto
                    // nothing (an As Prescribed Session already says so with its
                    // verdict alone, and a Self-Directed one has no plan to
                    // compare against at all).
                    const changes = deviations(item.diff)
                    const expandable = changes.length > 0
                    const expanded = expandable && expandedId === item.id

                    return (
                        <WorkoutListItem
                            workout={item}
                            onPress={expandable ? () => setExpandedId(expanded ? null : item.id) : undefined}
                        >
                            {expanded ? (
                                <View style={[styles.diffWrap, { borderTopColor: theme.lineSoft }]}>
                                    <SessionDiff diff={item.diff} />
                                    <Pressable onPress={() => setExpandedId(null)} hitSlop={8}>
                                        <ThemedText tone="accent" style={styles.hideComparison}>
                                            Hide comparison
                                        </ThemedText>
                                    </Pressable>
                                </View>
                            ) : null}
                        </WorkoutListItem>
                    )
                }}
            />
        </ThemedView>
    )
}

export default ClientDetail

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md + 2,
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: Space.lg,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: Radius.pill,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        gap: 2,
    },
    listContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: Space.xxl,
    },
    historyLabel: {
        marginBottom: Space.xs,
    },
    empty: {
        marginTop: Space.sm,
    },
    diffWrap: {
        borderTopWidth: 1,
        paddingTop: Space.md,
        gap: Space.md,
    },
    hideComparison: {
        fontFamily: FontFamily.label,
        fontSize: 12,
    },
})
