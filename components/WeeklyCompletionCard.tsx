import { StyleSheet, View } from 'react-native'

import ThemedCard from './ThemedCard'
import ThemedText from './ThemedText'
import ProgressSegments from './ProgressSegments'
import SectionLabel from './SectionLabel'
import { Space } from '../constants/Layout'
import type { WeeklyCompletion } from '../utils/weeklyCompletion'

// Private: it is the shape of one prop on this card and nothing outside it
// has ever named the type.
type WeeklyBreakdownItem = {
    /** The Template's name, denormalised by the caller so this card needs no read of its own. */
    name: string
    done: number
    target: number
}

/**
 * What a Trainer came for, above everything else on a Client's page: how much
 * of the week's expected work has happened. Drawn as Signal's one raised card
 * on this screen - "the one thing you came to do" is ThemedCard's own name for
 * that surface - because everything else here exists to support this answer.
 *
 * Two shapes, decided by whether there is a denominator at all. A Client with
 * active Assignments gets the ratio, the segmented bar and a per-Template
 * breakdown; one with none gets the count on its own and a line saying why
 * there is nothing to measure it against. That is not a degraded state -
 * nothing is wrong with a Client who trains without a prescription - so it
 * reads as a fact rather than an omission.
 *
 * The bar is capped at full but the number is not: a Client who trained five
 * times against three expected reads "5 of 3", because that is what happened.
 * Clamping the figure would hide exactly the case a Trainer most wants to see.
 *
 * The breakdown colours each Template's own ratio rather than the line as a
 * whole, so a Trainer can see *which* prescription is met rather than only
 * that the total is: the accent once met, plain until then. Never amber, which
 * means Modified and nothing else.
 */
const WeeklyCompletionCard = ({
    completion,
    breakdown,
}: {
    completion: WeeklyCompletion
    breakdown?: WeeklyBreakdownItem[]
}) => {
    const { completed, expected } = completion
    const hasTarget = expected != null && expected > 0

    return (
        <ThemedCard raised style={styles.card}>
            <SectionLabel>THIS WEEK</SectionLabel>

            <View style={styles.figureRow}>
                <ThemedText variant="display" tone="title" style={styles.figure}>
                    {completed}
                </ThemedText>
                <ThemedText variant="body" tone="body" style={styles.unit}>
                    {hasTarget
                        ? `of ${expected} session${expected === 1 ? '' : 's'} expected`
                        : `session${completed === 1 ? '' : 's'} completed`}
                </ThemedText>
            </View>

            {hasTarget ? (
                <>
                    <ProgressSegments total={expected} filled={Math.min(completed, expected)} />
                    {breakdown && breakdown.length > 0 ? (
                        <ThemedText variant="small" tone="muted">
                            {breakdown.map((item, index) => (
                                <ThemedText key={item.name} variant="small" tone="muted">
                                    {index > 0 ? '   ·   ' : ''}
                                    {item.name}{' '}
                                    <ThemedText
                                        variant="small"
                                        tone={item.done >= item.target ? 'accent' : 'title'}
                                        style={styles.tabular}
                                    >
                                        {item.done} of {item.target}
                                    </ThemedText>
                                </ThemedText>
                            ))}
                        </ThemedText>
                    ) : null}
                </>
            ) : (
                // Said plainly, because "0 of 0" would be the alternative and it
                // reads as a failure. There is no schedule in this system, so
                // with nothing assigned there is genuinely nothing to be behind
                // on.
                <ThemedText variant="small" tone="muted">
                    Nothing assigned right now, so there&apos;s no target to measure this against.
                </ThemedText>
            )}
        </ThemedCard>
    )
}

export default WeeklyCompletionCard

const styles = StyleSheet.create({
    card: {
        padding: Space.lg,
        gap: Space.lg,
    },
    figureRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Space.sm,
    },
    // TOKENS.md calls this figure out at roughly 30px rather than the
    // `display` token's own 33 - close enough to reuse the token's family,
    // weight and tracking ratio rather than inventing a size the scale
    // doesn't otherwise need.
    figure: {
        fontSize: 30,
        fontVariant: ['tabular-nums'],
    },
    unit: {
        flexShrink: 1,
        paddingBottom: 3,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
})
