import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import Pressable from '../../../components/Touchable'
import { Redirect, useRouter } from 'expo-router'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedCard from '../../../components/ThemedCard'
import ProgressSegments from '../../../components/ProgressSegments'
import OfflineBanner from '../../../components/OfflineBanner'
import ScreenSubtitle from '../../../components/ScreenSubtitle'
import Spacer from '../../../components/Spacer'
import FadeIn from '../../../components/FadeIn'
import { PlaceholderRows } from '../../../components/Placeholder'
import { Space, SCREEN_PADDING } from '../../../constants/Layout'
import { useAuth } from '../../../contexts/AuthContext'
import { useClients } from '../../../hooks/useClients'
import { useOffline } from '../../../hooks/useOffline'
import { useSessions } from '../../../hooks/useSessions'
import { useTrainerAssignments } from '../../../hooks/useAssignments'
import { weeklyCompletion } from '../../../utils/weeklyCompletion'
import type { WeeklyCompletion } from '../../../utils/weeklyCompletion'

/**
 * "n of m", the same figure a Client sees for one Assignment on Today, here
 * summed across all of them for one row of somebody else's week. Amber only
 * once they are actually short - a Client who has matched or beaten what was
 * asked reads in the ordinary title colour, because this is ranking, not a
 * deadline (ADR 0001). A Client with nothing assigned has no ratio at all
 * (see utils/weeklyCompletion) and says so as a plain fact instead.
 */
const RosterFigure = ({ completion }: { completion: WeeklyCompletion }) => {
    const { completed, expected } = completion

    if (expected == null) {
        return (
            <ThemedText variant="small" tone="faint">
                Nothing assigned
            </ThemedText>
        )
    }

    // Plain until met, then the accent. Never amber, which means Modified
    // and nothing else (UI review, issue 14) - mid-week is not a warning.
    const met = completed >= expected

    return (
        <View style={styles.figure}>
            <ThemedText variant="small" tone={met ? 'accent' : 'muted'}>
                <ThemedText variant="cardTitle" tone={met ? 'accent' : 'title'} style={styles.tabular}>
                    {completed}
                </ThemedText>{' '}
                of {expected}
            </ThemedText>
            <ProgressSegments
                total={expected}
                filled={Math.min(completed, expected)}
                style={{ width: Math.min(60, expected * 15) }}
            />
        </View>
    )
}

/** What one row knows once its own Sessions subscription has actually answered. */
type RowReport = {
    completion: WeeklyCompletion
    /** Still on the first, loading `[]` from useSessions - a `completed: 0` here is not yet an answer. */
    loading: boolean
    offline: boolean
}

/**
 * One Client, and how much of this week's expected work they've done.
 *
 * Its own component so it can hold its own Sessions subscription: there is no
 * query that answers "how is my whole roster doing" in one read - a Session
 * carries a clientId and nothing that names the Trainer, so rules deny
 * anything broader (see firestore.rules) - so this is one subscription per
 * row, the same way Today's HeroCard resolves its own Template per Assignment.
 * `onReport` sends the result back up so the list above can rank by it and fold
 * a failed read into its own offline banner; this component renders nothing
 * from that beyond its own row.
 */
const ClientRosterRow = ({
    client,
    assignments,
    onPress,
    onReport,
    hidden,
}: {
    client: any
    assignments: any[]
    onPress: () => void
    onReport: (clientId: string, report: RowReport) => void
    /** Mounted but undrawn until the roster's order settles - see ClientsRoster. */
    hidden?: boolean
}) => {
    const { sessions, loading, offline } = useSessions(client.uid)
    const completion = weeklyCompletion(sessions, assignments)

    useEffect(() => {
        onReport(client.uid, { completion, loading, offline })
        // completion is a fresh object every render; the fields inside it (and
        // loading/offline beside it) are what actually changed, and what the
        // parent needs to react to.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client.uid, completion.completed, completion.expected, loading, offline])

    if (hidden) return null

    // Mounted fresh when the roster reveals it, so this plays then.
    return (
        <FadeIn>
            <Pressable onPress={onPress}>
                <ThemedCard style={styles.row}>
                    <View style={styles.identity}>
                        <ThemedText variant="cardTitle" tone="title" numberOfLines={1}>
                            {client.name}
                        </ThemedText>
                        <ThemedText variant="small" tone="muted" numberOfLines={1}>
                            {client.email}
                        </ThemedText>
                    </View>
                    <RosterFigure completion={completion} />
                </ThemedCard>
            </Pressable>
        </FadeIn>
    )
}

/**
 * The Trainer's roster, ranked by who needs a look.
 *
 * Ordered by how far behind each Client is on their own summed Target
 * Frequency - the same ratio weeklyCompletion computes for one Client's page,
 * here computed for all of them so the list can put whoever needs attention
 * first (see docs/adr - there is no due date to sort by, only how much of what
 * was expected has happened). A Client on track sinks toward the bottom; one
 * with nothing assigned is not behind anything and sorts to the very bottom,
 * alphabetically among their own kind, rather than reading as the most urgent
 * row on the screen.
 *
 * The ranking is what a Trainer opened this screen for, but it is assembled
 * from up to N independent Sessions subscriptions landing one at a time (see
 * ClientRosterRow), and every arrival used to re-sort the whole list - so a
 * finger already descending on row 0 could land on whichever Client ranked
 * worst by the time the tap registered. So the order is computed **once**,
 * the first moment every row has actually reported (a row still loading has
 * not reported - its `completed: 0` is not yet an answer), and then frozen
 * for the rest of this mount: a count that changes afterwards does not
 * reopen the sort, and the roster re-ranks next time the Trainer visits.
 * Until it settles, the list holds still in plain list order rather than
 * resorting on partial data.
 */
const ClientsRoster = () => {
    const { profile } = useAuth()
    const router = useRouter()

    const { clients, loading, offline: clientsOffline, retry: retryClients } = useClients(
        profile?.role === 'trainer' ? profile.uid : null
    )
    const {
        assignments: allAssignments,
        offline: assignmentsOffline,
        retry: retryAssignments,
    } = useTrainerAssignments(profile?.role === 'trainer' ? profile.uid : null)

    const retry = () => {
        retryClients()
        retryAssignments()
    }

    const assignmentsByClientId = useMemo(() => {
        const byClient: Record<string, any[]> = {}
        allAssignments.forEach((assignment) => {
            if (!byClient[assignment.clientId]) byClient[assignment.clientId] = []
            byClient[assignment.clientId].push(assignment)
        })
        return byClient
    }, [allAssignments])

    const [rowReports, setRowReports] = useState<Record<string, RowReport>>({})
    const reportRow = useCallback((clientId: string, report: RowReport) => {
        setRowReports((prev) => {
            const existing = prev[clientId]
            if (
                existing &&
                existing.completion.completed === report.completion.completed &&
                existing.completion.expected === report.completion.expected &&
                existing.loading === report.loading &&
                existing.offline === report.offline
            ) {
                return prev
            }
            return { ...prev, [clientId]: report }
        })
    }, [])

    // Committed once, per the module comment above, and held in state (not a
    // ref) so the freeze itself is what triggers orderedClients to recompute -
    // clients and rowReports can both be unchanged on the render where the
    // last row reports in.
    const [settledOrder, setSettledOrder] = useState<string[] | null>(null)
    useEffect(() => {
        if (settledOrder || clients.length === 0) return
        const allReported = clients.every((c) => rowReports[c.uid] && !rowReports[c.uid].loading)
        if (!allReported) return

        const ratioOf = (client: any) => {
            const completion = rowReports[client.uid]?.completion
            if (!completion || completion.expected == null || completion.expected === 0) return null
            return completion.completed / completion.expected
        }

        setSettledOrder(
            [...clients]
                .sort((a, b) => {
                    const ra = ratioOf(a)
                    const rb = ratioOf(b)
                    if (ra != null && rb != null) return ra - rb
                    if (ra != null) return -1
                    if (rb != null) return 1
                    return (a.name ?? '').localeCompare(b.name ?? '')
                })
                .map((c) => c.uid)
        )
    }, [clients, rowReports, settledOrder])

    const orderedClients = useMemo(() => {
        if (!settledOrder) return clients

        const byId = new Map(clients.map((c) => [c.uid, c]))
        const known = new Set(settledOrder)
        const ranked = settledOrder.map((id) => byId.get(id)).filter(Boolean) as any[]
        // A Client who shows up after the order froze (linked mid-visit) has
        // earned no place in it yet; appended rather than reopening the sort.
        const unranked = clients.filter((c) => !known.has(c.uid))
        return [...ranked, ...unranked]
    }, [clients, settledOrder])

    // Each row's own Sessions read can time out same as the roster's own reads
    // can - see hooks/useOffline.ts - and a row that silently shows "0 of 3" on
    // a failed read is a lie about a real number, not an empty state.
    const anyRowOffline = Object.values(rowReports).some((r) => r.offline)

    // Until the order freezes, the rows are mounted - each one holds the read
    // the ranking waits on - but not drawn, and placeholders stand in. Drawing
    // them meant a list in name order, each figure ticking up from "0 of 3" as
    // its read landed, then the whole list reshuffling into rank order: three
    // changes of mind before the answer. Now the answer arrives once, already
    // sorted. A row that times out still reports (not loading, offline), so
    // this cannot hold the screen hostage past the snapshot timeout.
    const ranking = clients.length > 0 && !settledOrder
    const offline = useOffline(clientsOffline, assignmentsOffline, anyRowOffline)

    if (profile && profile.role !== 'trainer') {
        return <Redirect href="/" />
    }

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={orderedClients}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        <OfflineBanner visible={offline} onRetry={retry} />
                        <ScreenSubtitle>
                            {loading ? ' ' : `${clients.length} client${clients.length === 1 ? '' : 's'}`}
                        </ScreenSubtitle>
                        {ranking ? <PlaceholderRows count={Math.min(clients.length, 5)} /> : null}
                    </>
                }
                ItemSeparatorComponent={ranking ? null : () => <Spacer height={Space.sm + 2} />}
                ListEmptyComponent={
                    loading ? (
                        <PlaceholderRows />
                    ) : (
                        <FadeIn>
                            <ThemedText variant="body" tone="muted" style={styles.empty}>
                                No clients yet. Share your invite code (see Profile tab) so clients can link to you
                                when they register.
                            </ThemedText>
                        </FadeIn>
                    )
                }
                renderItem={({ item }) => (
                    <ClientRosterRow
                        client={item}
                        assignments={assignmentsByClientId[item.uid] ?? []}
                        onPress={() => router.push(`/clients/${item.uid}`)}
                        onReport={reportRow}
                        hidden={ranking}
                    />
                )}
            />
        </ThemedView>
    )
}

export default ClientsRoster

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SCREEN_PADDING,
    },
    listContent: {
        paddingBottom: Space.xxl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Space.md,
    },
    identity: {
        flex: 1,
        gap: 2,
    },
    figure: {
        alignItems: 'flex-end',
        gap: Space.xs,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    empty: {
        marginTop: Space.sm,
    },
})
