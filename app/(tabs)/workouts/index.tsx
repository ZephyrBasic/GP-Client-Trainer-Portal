import { FlatList, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import WorkoutListItem from '../../../components/WorkoutListItem'
import OfflineBanner from '../../../components/OfflineBanner'
import ScreenSubtitle from '../../../components/ScreenSubtitle'
import Spacer from '../../../components/Spacer'
import FadeIn from '../../../components/FadeIn'
import { PlaceholderRows } from '../../../components/Placeholder'
import { useAuth } from '../../../contexts/AuthContext'
import { useSessions } from '../../../hooks/useSessions'
import { useOffline } from '../../../hooks/useOffline'
import { SCREEN_PADDING } from '../../../constants/Layout'

/**
 * A Client's own performed history - what Today looked like on every day
 * before this one.
 *
 * Everything about choosing and starting a workout lives on Today now
 * (app/(tabs)/index.tsx): the prescribed list, the Client's own Templates, the
 * active-Session banner and the "something else" paths all moved there with
 * Signal, since this screen's only job left is looking back. A Trainer never
 * reaches this file - the tab itself sends them to templates/ instead
 * (app/(tabs)/_layout.tsx) - so there is no role branch here to maintain.
 */
const WorkoutsHistory = () => {
    const { profile } = useAuth()
    const router = useRouter()

    const { sessions, loading, offline: sessionsOffline, retry } = useSessions(profile?.uid)
    const offline = useOffline(sessionsOffline)

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        <OfflineBanner visible={offline} onRetry={retry} />
                        {/* Blank rather than "Nothing logged yet" while the
                            read is out: a count that claims zero and then
                            changes its mind is the flicker, not the answer. */}
                        <ScreenSubtitle>
                            {loading
                                ? ' '
                                : sessions.length > 0
                                  ? `${sessions.length} session${sessions.length === 1 ? '' : 's'}`
                                  : 'Nothing logged yet'}
                        </ScreenSubtitle>
                    </>
                }
                ItemSeparatorComponent={() => <Spacer height={10} />}
                ListEmptyComponent={
                    loading ? (
                        <PlaceholderRows />
                    ) : (
                        <FadeIn>
                            <ThemedText variant="body" tone="muted" style={styles.empty}>
                                No sessions yet. Start a workout from Today, or log one you already did.
                            </ThemedText>
                        </FadeIn>
                    )
                }
                renderItem={({ item }) => (
                    <WorkoutListItem workout={item} onPress={() => router.push(`/workouts/${item.id}`)} />
                )}
            />
        </ThemedView>
    )
}

export default WorkoutsHistory

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SCREEN_PADDING,
    },
    listContent: {
        paddingBottom: 20,
    },
    empty: {
        marginTop: 10,
    },
})
