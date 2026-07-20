import { StyleSheet, View } from 'react-native'
import ThemedCard from './ThemedCard'
import ThemedText from './ThemedText'
import Spacer from './Spacer'
import { Colors } from '../constants/Colors'

const WorkoutSummaryCard = ({ stats }) => {
    const { totalWorkouts, totalVolume, thisWeekVolume, totalReps, totalWorkSeconds, recent, maxRecentVolume } = stats

    // Volume counts loaded work only, so bodyweight and timed work are shown
    // alongside it rather than disappearing into a zero.
    const workMinutes = Math.round((totalWorkSeconds ?? 0) / 60)

    return (
        <ThemedCard>
            <ThemedText title={true} style={styles.heading}>
                Summary
            </ThemedText>
            <Spacer height={12} />
            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <ThemedText title={true} style={styles.statNumber}>
                        {totalWorkouts}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>Workouts</ThemedText>
                </View>
                <View style={styles.stat}>
                    <ThemedText title={true} style={styles.statNumber}>
                        {Math.round(thisWeekVolume).toLocaleString()}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>This week's volume</ThemedText>
                </View>
                <View style={styles.stat}>
                    <ThemedText title={true} style={styles.statNumber}>
                        {Math.round(totalVolume).toLocaleString()}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>All-time volume</ThemedText>
                </View>
            </View>

            <Spacer height={12} />
            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <ThemedText title={true} style={styles.statNumber}>
                        {(totalReps ?? 0).toLocaleString()}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>Total reps</ThemedText>
                </View>
                <View style={styles.stat}>
                    <ThemedText title={true} style={styles.statNumber}>
                        {workMinutes.toLocaleString()}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>Timed work (min)</ThemedText>
                </View>
            </View>

            {recent.length > 0 && (
                <>
                    <Spacer height={16} />
                    <ThemedText style={styles.label}>Recent volume</ThemedText>
                    <Spacer height={8} />
                    {recent.map((entry) => (
                        <View key={entry.id} style={styles.barRow}>
                            <View style={styles.barTrack}>
                                <View
                                    style={[
                                        styles.bar,
                                        { width: `${Math.max(4, (entry.volume / maxRecentVolume) * 100)}%` },
                                    ]}
                                />
                            </View>
                            <ThemedText style={styles.barValue}>{Math.round(entry.volume)}</ThemedText>
                        </View>
                    ))}
                </>
            )}
        </ThemedCard>
    )
}

export default WorkoutSummaryCard

const styles = StyleSheet.create({
    heading: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    stat: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 4,
    },
    label: {
        fontSize: 13,
        opacity: 0.8,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    barTrack: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(128,128,128,0.25)',
        overflow: 'hidden',
        marginRight: 8,
    },
    bar: {
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
    },
    barValue: {
        width: 50,
        fontSize: 12,
        textAlign: 'right',
    },
})
