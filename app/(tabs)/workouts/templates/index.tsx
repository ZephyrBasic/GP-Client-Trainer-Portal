import { FlatList, StyleSheet, View } from 'react-native'
import Pressable from '../../../../components/Touchable'
import { useRouter } from 'expo-router'

import ThemedView from '../../../../components/ThemedView'
import ThemedText from '../../../../components/ThemedText'
import ThemedCard from '../../../../components/ThemedCard'
import ThemedChip from '../../../../components/ThemedChip'
import ThemedButton from '../../../../components/ThemedButton'
import OfflineBanner from '../../../../components/OfflineBanner'
import ScreenSubtitle from '../../../../components/ScreenSubtitle'
import Spacer from '../../../../components/Spacer'
import FadeIn from '../../../../components/FadeIn'
import { PlaceholderRows } from '../../../../components/Placeholder'
import { Space, SCREEN_PADDING } from '../../../../constants/Layout'
import { useAuth } from '../../../../contexts/AuthContext'
import { useTrainerAssignments } from '../../../../hooks/useAssignments'
import { useClients } from '../../../../hooks/useClients'
import { useOffline } from '../../../../hooks/useOffline'
import { useWorkoutTemplates } from '../../../../hooks/useWorkoutTemplates'

/**
 * The Templates this person authored.
 *
 * Keyed on the signed-in uid rather than on a role, so it serves a Client's own
 * saved Templates unchanged once those exist. Prescribed Templates - the ones a
 * Client can see because a Trainer assigned them - arrive with Assignments and
 * belong in a second list, not this one.
 */
const WorkoutTemplates = () => {
    const { profile } = useAuth()
    const router = useRouter()
    const { templates, loading, offline: templatesOffline, retry: retryTemplates } =
        useWorkoutTemplates(profile?.uid)
    // Only for the count in the subtitle - "who is looking at these?" is the
    // question a Trainer opens this list with, and the answer is one number.
    const { clients, loading: clientsLoading, offline: clientsOffline, retry: retryClients } = useClients(
        profile?.role === 'trainer' ? profile.uid : null
    )
    // Only to count who is on each Template. One subscription for the whole
    // roster rather than a read per row: the Trainer's Assignments are already
    // fetched as one query elsewhere, and "assigned to 3 clients" is the answer
    // this list exists to give.
    const {
        assignments,
        offline: assignmentsOffline,
        retry: retryAssignments,
    } = useTrainerAssignments(profile?.role === 'trainer' ? profile.uid : null)
    const offline = useOffline(templatesOffline, clientsOffline, assignmentsOffline)

    const retry = () => {
        retryTemplates()
        retryClients()
        retryAssignments()
    }

    // Inactive Assignments do not count - an unassigned Client is not on this
    // workout, however much of their record survives (ADR 0004).
    const assignedCount = assignments.reduce((counts, assignment) => {
        if (assignment.active !== false) {
            counts[assignment.templateId] = (counts[assignment.templateId] ?? 0) + 1
        }
        return counts
    }, {})

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={templates}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        <OfflineBanner visible={offline} onRetry={retry} />
                        {/* Blank until both counts are real - "0 templates"
                            on the way to "4 templates" is a flicker. */}
                        <ScreenSubtitle>
                            {loading || clientsLoading ? (
                                ' '
                            ) : (
                                <>
                                    {templates.length} template{templates.length === 1 ? '' : 's'}
                                    {profile?.role === 'trainer'
                                        ? ` · ${clients.length} client${clients.length === 1 ? '' : 's'}`
                                        : ''}
                                </>
                            )}
                        </ScreenSubtitle>
                    </>
                }
                ListFooterComponent={
                    <>
                        {/* Under the list, not over it. The Trainer opens this
                            screen to look at what they already wrote far more
                            often than to write another one, and a button above
                            the fold pushes the answer down. */}
                        <Spacer height={Space.lg} />
                        <ThemedButton onPress={() => router.push('/workouts/templates/new')}>
                            <ThemedText variant="cardTitle" tone="onPrimary">
                                New template
                            </ThemedText>
                        </ThemedButton>
                    </>
                }
                ItemSeparatorComponent={() => <Spacer height={Space.sm + 2} />}
                ListEmptyComponent={
                    loading ? (
                        <PlaceholderRows />
                    ) : (
                        <FadeIn>
                            <ThemedText variant="body" tone="muted" style={styles.empty}>
                                No templates yet. Tap &quot;New template&quot; to build a workout you can reuse.
                            </ThemedText>
                        </FadeIn>
                    )
                }
                renderItem={({ item }) => (
                    // Opening a Template is editing it, and editing publishes a
                    // new Version - so the row goes straight to the editor rather
                    // than through a read-only detail screen it would only have
                    // to offer an "Edit" button on.
                    <Pressable onPress={() => router.push(`/workouts/templates/${item.id}`)}>
                        {/* Drawn like every other: an unassigned Template was
                            greyed out and read as disabled, when it is fully
                            editable. The line under the name says who has it. */}
                        <ThemedCard>
                            <View style={styles.titleRow}>
                                <ThemedText
                                    variant="cardTitle"
                                    tone="title"
                                    style={styles.name}
                                    numberOfLines={1}
                                >
                                    {item.name}
                                </ThemedText>
                                {/* On the title row, not under it. "Which version
                                    are my clients on right now?" is what this
                                    list is for, so it belongs beside the name
                                    rather than as a line of prose below it.
                                    Read off the Template rather than by opening
                                    the Version, so the list still renders from
                                    one query on bad signal. */}
                                <ThemedChip
                                    label={`v${item.currentVersionNumber ?? 1}`}
                                    uppercase={false}
                                />
                            </View>
                            <ThemedText variant="small" tone="muted" style={styles.version}>
                                {[
                                    item.currentVersionExerciseCount
                                        ? `${item.currentVersionExerciseCount} exercise${item.currentVersionExerciseCount === 1 ? '' : 's'}`
                                        : null,
                                    assignedCount[item.id]
                                        ? `assigned to ${assignedCount[item.id]} client${assignedCount[item.id] === 1 ? '' : 's'}`
                                        : 'not assigned',
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </ThemedText>
                        </ThemedCard>
                    </Pressable>
                )}
            />
        </ThemedView>
    )
}

export default WorkoutTemplates

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SCREEN_PADDING,
    },
    listContent: {
        paddingBottom: Space.xxl,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Space.sm + 2,
    },
    name: {
        flex: 1,
    },
    version: {
        marginTop: 2,
    },
    empty: {
        marginTop: Space.sm,
    },
})
