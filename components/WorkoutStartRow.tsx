import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Pressable from './Touchable'

import ThemedText from './ThemedText'
import ThemedCard from './ThemedCard'
import { Space } from '../constants/Layout'

/**
 * One workout a Client can start, however it got onto their list.
 *
 * A Workout Template is one kind of thing whoever wrote it (CONTEXT.md), so a
 * Trainer's prescription and a Client's own saved routine render as the same
 * row and start the same way. What differs is only what the sections around them
 * are called, what `right` shows - a target's "n of m" for a prescription,
 * a plain chevron for a Client's own - and, for a Client's own, that they may
 * edit it.
 *
 * The card is the start control - starting is what a Client came here to do, and
 * a row that is a button does not need a word on it saying so. Edit is a
 * separate tap so the two cannot be confused.
 *
 * `right` is a node rather than one more string prop: the two callers' trailing
 * content is a fraction over progress segments in one case and an icon in the
 * other, and neither fits a single "highlight" string the row used to take.
 *
 * A row that cannot be started still renders, drawn flat: knowing the workout is
 * there and currently unavailable beats it silently vanishing, and a list of
 * live workouts should not look identical to one that is waiting on something.
 */
const WorkoutStartRow = ({
    name,
    meta,
    /** Trailing content on the title row - a target figure, a chevron, or nothing. */
    right,
    onStart,
    /** Absent for a Template this Client did not author; only the author edits. */
    onEdit,
    /** True while a Session is already open, or one is being started. */
    disabled,
}: {
    name: string
    meta?: string
    right?: ReactNode
    onStart: () => void
    onEdit?: () => void
    disabled?: boolean
}) => (
    <Pressable onPress={onStart} disabled={disabled}>
        <ThemedCard muted={disabled}>
            <View style={styles.row}>
                <View style={styles.left}>
                    <ThemedText
                        variant="cardTitle"
                        tone={disabled ? 'muted' : 'title'}
                        numberOfLines={1}
                    >
                        {name}
                    </ThemedText>
                    {meta ? (
                        <ThemedText variant="small" tone="muted">
                            {meta}
                        </ThemedText>
                    ) : null}
                </View>
                {right}
            </View>

            {onEdit ? (
                // Its own tap target rather than a swipe or a long press:
                // editing publishes a new Version (ADR 0002), which is not
                // something to discover by accident. minHeight clears the
                // 44px floor itself rather than leaning on hitSlop, whose
                // padding only widens the tap target without widening the
                // row - a short line of text plus 8px of slop still fell
                // short.
                <Pressable onPress={onEdit} hitSlop={8} style={styles.edit}>
                    <ThemedText variant="small" tone="accent">
                        Edit workout →
                    </ThemedText>
                </Pressable>
            ) : null}
        </ThemedCard>
    </Pressable>
)

export default WorkoutStartRow

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md,
    },
    left: {
        flex: 1,
        gap: 4,
    },
    edit: {
        marginTop: Space.sm,
        // Nothing interactive under 44px: the text alone was ~16px tall, and
        // hitSlop widens the tap target without widening the row it sits in,
        // so the two together still fell short.
        minHeight: 44,
        justifyContent: 'center',
    },
})
