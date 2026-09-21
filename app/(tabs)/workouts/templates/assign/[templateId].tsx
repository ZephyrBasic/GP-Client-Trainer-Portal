import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'

import ThemedView from '../../../../../components/ThemedView'
import ThemedText from '../../../../../components/ThemedText'
import ThemedButton, { buttonTextColor } from '../../../../../components/ThemedButton'
import ThemedCard from '../../../../../components/ThemedCard'
import ThemedChip from '../../../../../components/ThemedChip'
import OfflineBanner from '../../../../../components/OfflineBanner'
import { PlaceholderRows } from '../../../../../components/Placeholder'
import ScreenSubtitle from '../../../../../components/ScreenSubtitle'
import Spacer from '../../../../../components/Spacer'
import { Colors } from '../../../../../constants/Colors'
import { Space, SCREEN_PADDING } from '../../../../../constants/Layout'
import { FontFamily } from '../../../../../constants/Type'
import { useAuth } from '../../../../../contexts/AuthContext'
import { useOffline } from '../../../../../hooks/useOffline'
import { useClients } from '../../../../../hooks/useClients'
import { useWorkoutTemplate } from '../../../../../hooks/useWorkoutTemplates'
import {
    assignTemplateToClient,
    assignmentsByClient,
    setTargetFrequency,
    unassignTemplateFromClient,
    useTrainerAssignments,
} from '../../../../../hooks/useAssignments'
import { overriddenExerciseCount } from '../../../../../utils/prescription'
import {
    DEFAULT_TIMES_PER_WEEK,
    MAX_TIMES_PER_WEEK,
    MIN_TIMES_PER_WEEK,
    formatTargetFrequency,
} from '../../../../../utils/targetFrequency'

/**
 * Putting one Workout Template on Clients' lists.
 *
 * Assigning and setting a Target Frequency are the same act, so they are the
 * same screen: a roster where each row is either "not assigned" or a frequency
 * the Trainer can nudge.
 *
 * Unassigning is on the same row and is deliberately *not* the inverse of the
 * assign button. It marks the Assignment inactive rather than deleting it, so
 * the workout leaves the Client's list while everything resting on the record
 * surviving stays true - their past Sessions' access to the Versions they cite,
 * and the target loads set for them (ADR 0004, and unassignTemplateFromClient).
 */
const AssignTemplate = () => {
    const { templateId } = useLocalSearchParams<{ templateId: string }>()
    const router = useRouter()
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { profile } = useAuth()

    const { template, loading: templateLoading, offline: templateOffline, retry: retryTemplate } =
        useWorkoutTemplate(templateId)
    const { clients, loading: clientsLoading, offline: clientsOffline, retry: retryClients } = useClients(
        profile?.role === 'trainer' ? profile.uid : null
    )
    const {
        assignments,
        offline: assignmentsOffline,
        retry: retryAssignments,
    } = useTrainerAssignments(profile?.role === 'trainer' ? profile.uid : null)

    const offline = useOffline(templateOffline, clientsOffline, assignmentsOffline)

    // Three reads behind one banner button, same as the editor screen: any of
    // them can be the one that timed out and the Trainer cannot tell which.
    const retry = () => {
        retryTemplate()
        retryClients()
        retryAssignments()
    }

    const [error, setError] = useState('')
    // Which row is mid-write. One at a time is enough: a Trainer taps one row,
    // and disabling just that row keeps the rest of the list live.
    const [busyClientId, setBusyClientId] = useState(null)
    // Which row is asking to confirm an unassign. Inline and per-row rather than
    // a modal: the roster is the context for the question, and "which client?"
    // is the thing a dialog would take away.
    const [confirmingClientId, setConfirmingClientId] = useState(null)

    const byClient = assignmentsByClient(assignments, templateId)
    // How many of this Trainer's Clients are on this workout right now. Inactive
    // Assignments are excluded, matching what the rows say and what the Client's
    // own list honours.
    const assignedCount = clients.filter((client) => byClient[client.uid]?.active !== false && byClient[client.uid])
        .length

    // A Client reaching this route would only be denied by the rules anyway, but
    // being bounced beats being shown an empty roster and a failed write.
    if (profile && profile.role !== 'trainer') {
        return <Redirect href="/workouts" />
    }

    const run = async (clientId, write) => {
        setError('')
        setBusyClientId(clientId)
        try {
            await write()
        } catch (err) {
            setError(err.message || 'Could not save that. Try again.')
        }
        setBusyClientId(null)
    }

    const handleAssign = (clientId) =>
        run(clientId, () =>
            assignTemplateToClient({
                templateId,
                clientId,
                trainerId: profile.uid,
                timesPerWeek: DEFAULT_TIMES_PER_WEEK,
                // An Assignment that exists but is inactive is re-activated
                // rather than created again - the document is never deleted, so
                // creating over it would be denied.
                existing: Boolean(byClient[clientId]),
            })
        )

    const handleFrequency = (clientId, timesPerWeek) =>
        run(clientId, () => setTargetFrequency({ templateId, clientId, timesPerWeek }))

    const handleUnassign = async (clientId) => {
        await run(clientId, () => unassignTemplateFromClient({ templateId, clientId }))
        setConfirmingClientId(null)
    }

    if (!template) {
        return (
            <ThemedView style={styles.container}>
                <OfflineBanner visible={offline} onRetry={retry} />
                {templateLoading ? (
                    <PlaceholderRows />
                ) : (
                    <ThemedText variant="body" tone="muted">
                        This template isn&apos;t available.
                    </ThemedText>
                )}
            </ThemedView>
        )
    }

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={clients}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        <OfflineBanner visible={offline} onRetry={retry} />
                        {/* The native header says what kind of screen this is;
                            this says which one. The Template's name belongs
                            here rather than as a second heading, since it is the
                            scope of everything below. */}
                        <ScreenSubtitle>
                            {template.name} · v{template.currentVersionNumber ?? 1} · {assignedCount} of{' '}
                            {clients.length} assigned
                        </ScreenSubtitle>
                        <ThemedText variant="meta" tone="muted">
                            Everyone you assign sees version {template.currentVersionNumber ?? 1}.
                        </ThemedText>
                        {error ? (
                            <>
                                <Spacer height={Space.md} />
                                <ThemedText variant="body" tone="danger">
                                    {error}
                                </ThemedText>
                            </>
                        ) : null}
                        <Spacer height={Space.lg} />
                    </>
                }
                ItemSeparatorComponent={() => <Spacer height={Space.sm + 2} />}
                ListEmptyComponent={
                    clientsLoading ? (
                        <PlaceholderRows />
                    ) : (
                        <ThemedText variant="body" tone="muted">
                            No clients yet. Share your invite code (see Profile tab) so clients can link to you
                            when they register.
                        </ThemedText>
                    )
                }
                ListFooterComponent={
                    <>
                        <Spacer height={Space.xl} />
                        {/* The point most easily misread on this screen. A
                            frequency looks like a schedule, and it is not one -
                            saying so here is cheaper than a Trainer discovering
                            it by wondering why nothing is ever overdue. */}
                        <ThemedText variant="meta" tone="muted" style={styles.footerNote}>
                            A target frequency is what you expect, not a schedule. There are no due dates
                            here: your client picks their own day and can repeat a workout as often as they
                            like.
                        </ThemedText>
                    </>
                }
                renderItem={({ item }) => {
                    const assignment = byClient[item.uid]
                    const assigned = Boolean(assignment) && assignment.active !== false
                    const busy = busyClientId === item.uid
                    const confirming = confirmingClientId === item.uid
                    const timesPerWeek = assignment?.timesPerWeek ?? DEFAULT_TIMES_PER_WEEK
                    const customised = overriddenExerciseCount(assignment)

                    // A Client with no assignment exists but is not on this
                    // workout, so the row is drawn flat rather than looking
                    // identical to one that is.
                    return (
                        <ThemedCard muted={!assigned}>
                            <View style={styles.row}>
                                <View style={styles.identity}>
                                    <View style={styles.titleRow}>
                                        <ThemedText
                                            variant="cardTitle"
                                            tone={assigned ? 'title' : 'muted'}
                                            numberOfLines={1}
                                        >
                                            {item.name}
                                        </ThemedText>
                                        {assigned ? <ThemedChip label="Assigned" /> : null}
                                    </View>
                                    {/* Three states, not two. A Client who
                                        was unassigned still has a record -
                                        their loads, and their history's
                                        access to the Versions it cites - so
                                        saying so is what tells the Trainer
                                        that re-assigning restores rather
                                        than starts over. */}
                                    {assigned ? null : (
                                        <ThemedText variant="meta" tone="muted">
                                            {assignment ? 'Unassigned - past sessions kept' : 'Not assigned'}
                                        </ThemedText>
                                    )}
                                </View>

                                {assigned ? (
                                    <View style={styles.stepper}>
                                        <Pressable
                                            onPress={() => handleFrequency(item.uid, timesPerWeek - 1)}
                                            disabled={busy || timesPerWeek <= MIN_TIMES_PER_WEEK}
                                            hitSlop={8}
                                        >
                                            <ThemedText
                                                tone="accent"
                                                style={[
                                                    styles.step,
                                                    (busy || timesPerWeek <= MIN_TIMES_PER_WEEK) &&
                                                        styles.stepDisabled,
                                                ]}
                                            >
                                                −
                                            </ThemedText>
                                        </Pressable>
                                        <ThemedText variant="cardTitle" tone="title" style={styles.frequency}>
                                            {formatTargetFrequency(timesPerWeek)}
                                        </ThemedText>
                                        <Pressable
                                            onPress={() => handleFrequency(item.uid, timesPerWeek + 1)}
                                            disabled={busy || timesPerWeek >= MAX_TIMES_PER_WEEK}
                                            hitSlop={8}
                                        >
                                            <ThemedText
                                                tone="accent"
                                                style={[
                                                    styles.step,
                                                    (busy || timesPerWeek >= MAX_TIMES_PER_WEEK) &&
                                                        styles.stepDisabled,
                                                ]}
                                            >
                                                +
                                            </ThemedText>
                                        </Pressable>
                                    </View>
                                ) : (
                                    <Pressable onPress={() => handleAssign(item.uid)} disabled={busy} hitSlop={8}>
                                        <ThemedText
                                            tone="accent"
                                            style={[styles.actionLink, busy && styles.stepDisabled]}
                                        >
                                            Assign
                                        </ThemedText>
                                    </Pressable>
                                )}
                            </View>

                            {/* Only once assigned: target loads belong to an
                                Assignment, so there is nowhere to put them until
                                one exists. Its own row rather than a third
                                control above, because it leaves this screen. */}
                            {assigned ? (
                                <>
                                    <Spacer height={Space.sm + 2} />
                                    <View style={styles.actionRow}>
                                        <Pressable
                                            onPress={() =>
                                                router.push(
                                                    `/workouts/templates/targets/${templateId}/${item.uid}`
                                                )
                                            }
                                            disabled={busy}
                                            hitSlop={8}
                                        >
                                            <ThemedText
                                                tone="accent"
                                                style={[styles.actionLink, busy && styles.stepDisabled]}
                                            >
                                                {customised > 0
                                                    ? `Own target loads on ${customised} exercise${customised === 1 ? '' : 's'} →`
                                                    : 'Set their target loads →'}
                                            </ThemedText>
                                        </Pressable>
                                        {confirming ? null : (
                                            <Pressable
                                                onPress={() => setConfirmingClientId(item.uid)}
                                                disabled={busy}
                                                hitSlop={8}
                                            >
                                                <ThemedText
                                                    tone="danger"
                                                    style={[styles.actionLink, busy && styles.stepDisabled]}
                                                >
                                                    Unassign
                                                </ThemedText>
                                            </Pressable>
                                        )}
                                    </View>
                                </>
                            ) : null}

                            {/* Says what it actually does, because the word
                                sounds destructive and is not: nothing is
                                deleted, and everything the Client already
                                performed keeps its workout name, its verdict
                                and its diff. */}
                            {confirming ? (
                                <>
                                    <Spacer height={Space.sm + 2} />
                                    <ThemedText variant="meta" tone="muted">
                                        Take this workout off {item.name}&apos;s list? Their past sessions
                                        against it are untouched, and their target loads are kept if you
                                        assign it again.
                                    </ThemedText>
                                    <Spacer height={Space.sm} />
                                    {/* Buttons, where the row above is links: this is
                                        the answer to a question, and it keeps the
                                        sides of the one it replaced - Unassign was on
                                        the right, so its confirmation is too, under
                                        the thumb that asked. Same shape as discarding
                                        a Session (components/ActiveSessionBanner). */}
                                    <View style={styles.confirmRow}>
                                        <ThemedButton
                                            variant="ghost"
                                            onPress={() => setConfirmingClientId(null)}
                                            disabled={busy}
                                            style={styles.confirmBtn}
                                        >
                                            <ThemedText tone="body" style={styles.actionLink}>
                                                Keep it
                                            </ThemedText>
                                        </ThemedButton>
                                        <ThemedButton
                                            variant="destructive"
                                            onPress={() => handleUnassign(item.uid)}
                                            disabled={busy}
                                            style={styles.confirmBtn}
                                        >
                                            <ThemedText
                                                style={[styles.actionLink, { color: buttonTextColor('destructive', theme) }]}
                                            >
                                                {busy ? 'Unassigning...' : 'Yes, unassign'}
                                            </ThemedText>
                                        </ThemedButton>
                                    </View>
                                </>
                            ) : null}
                        </ThemedCard>
                    )
                }}
            />
        </ThemedView>
    )
}

export default AssignTemplate

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SCREEN_PADDING,
    },
    listContent: {
        paddingBottom: Space.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Space.md,
    },
    identity: {
        flexShrink: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm + 2,
    },
    step: {
        fontFamily: FontFamily.heading,
        fontSize: 20,
        width: 22,
        textAlign: 'center',
    },
    stepDisabled: {
        opacity: 0.4,
    },
    frequency: {
        minWidth: 84,
        textAlign: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Space.md,
    },
    // Shared by every link-style action on this screen - Assign, Unassign,
    // the targets link, Keep it - so they read as one family of controls at
    // one weight rather than each row inventing its own.
    actionLink: {
        fontFamily: FontFamily.label,
        fontSize: 12,
    },
    footerNote: {
        textAlign: 'center',
        lineHeight: 18,
    },
    confirmRow: {
        flexDirection: 'row',
        gap: Space.sm,
    },
    confirmBtn: {
        flex: 1,
        padding: Space.sm,
    },
})
