import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import ThemedCard from './ThemedCard'
import ThemedText from './ThemedText'
import VerdictBadge, { SessionKindChip } from './VerdictBadge'
import { Colors } from '../constants/Colors'
import { Space } from '../constants/Layout'
import { shortDateLabel } from '../utils/dateInput'

/**
 * One performed Session in a history list.
 *
 * Titled by the **workout it set out to be** rather than by its date, which is
 * the whole of what versioning and verdicts buy: history reads as training
 * ("Lower Body A, modified") instead of as entries ("28/08/2026"). The date
 * moves into the meta line beside the counts, where it is still the first thing
 * after the name and no longer the only thing identifying the row.
 *
 * The name is denormalised onto the Session precisely so this row needs no
 * Version read to render, which is what makes a year of history usable on bad
 * signal.
 *
 * Volume is deliberately gone from this row, and gone from History altogether
 * (WorkoutSummaryCard, which used to total it above this list, is deleted with
 * Signal): it is a per-Exercise measure in the domain (CONTEXT.md), and a
 * whole-Session or all-time total was always a summary statistic wearing a
 * row's - and a screen's - clothes.
 *
 * Laid out as one row rather than a title row over a meta row, per
 * .claude/docs/design/Review.dc.html: the name and its meta line share a
 * column on the left, and the verdict - or the "Self-directed" chip standing
 * in for its absence - sits on the right at the row's own centre, not
 * crowding the name at the top.
 *
 * `children`, given, renders below the row inside the same card rather than a
 * second one underneath it - the Trainer's review reaches for this to expand
 * a row into its diff in place. Absent for the Client's own History, which has
 * nowhere to expand to: its tap navigates to the Session instead.
 *
 * `onPress` absent means inert, and the card renders with no `Pressable` at
 * all rather than one that swallows a tap and does nothing - the Trainer's
 * review passes it only for a Modified Session with deviations to expand, and
 * an As Prescribed row sitting pixel-identical beside it must not invite a tap
 * it cannot answer. When `onPress` is given and nothing is expanded yet, a
 * chevron says the row opens onto something; it is a reaction to `onPress`,
 * never to the verdict, so an As Prescribed or Self-Directed Session gains no
 * marker of its own (ADR 0005).
 */
const WorkoutListItem = ({
    workout,
    onPress,
    children,
}: {
    workout: any
    onPress?: () => void
    children?: ReactNode
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const exerciseCount = workout.exercises?.length ?? 0
    const dateLabel = workout.date?.toDate ? shortDateLabel(workout.date.toDate()) : 'Unknown date'
    const duration = workout.durationMinutes

    const card = (
        <ThemedCard style={styles.card}>
            <View style={styles.row}>
                <View style={styles.textCol}>
                    <ThemedText variant="cardTitle" tone="title" numberOfLines={1}>
                        {workout.templateName || 'Session without a plan'}
                    </ThemedText>
                    <ThemedText variant="small" tone="muted">
                        {dateLabel} · {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}
                        {/* Absent rather than zero: a duration nobody recorded is
                            not a workout that took no time. */}
                        {duration != null ? ` · ${duration} min` : ''}
                    </ThemedText>
                </View>
                {/* One or the other, never both and never neither: a
                    prescribed Session carries a verdict, and one without a
                    plan says that instead of leaving a gap the reader has to
                    interpret. */}
                <VerdictBadge verdict={workout.verdict} />
                <SessionKindChip session={workout} />
                {onPress && !children ? (
                    <Ionicons name="chevron-forward" size={18} color={theme.iconColor} />
                ) : null}
            </View>
            {children}
        </ThemedCard>
    )

    return onPress ? <Pressable onPress={onPress}>{card}</Pressable> : card
}

export default WorkoutListItem

const styles = StyleSheet.create({
    // A childless card is one row and this gap does nothing; a card the
    // Trainer's review expands gets a beat of space before what it expands
    // into, without either caller having to know about the other's layout.
    card: {
        gap: Space.md + 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md,
    },
    textCol: {
        flex: 1,
        gap: Space.xs,
    },
})
