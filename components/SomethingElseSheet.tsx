import { StyleSheet, useColorScheme } from 'react-native'
import Pressable from './Touchable'

import BottomSheet from './BottomSheet'
import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { Space } from '../constants/Layout'

type Props = {
    visible: boolean
    onClose: () => void
    onStartWithoutPlan: () => void
    onLogPastWorkout: () => void
    onSaveOwnWorkout: () => void
    /** True while a Session is already open (ADR 0003) - see Today's `blocked`. */
    startDisabled?: boolean
}

/**
 * The catch-all for training that doesn't fit the plan Today already shows:
 * no plan at all, a workout already finished, or a new one worth saving for
 * next time. One sheet behind a dashed "Start, log or plan a workout" row,
 * replacing the three ghost buttons workouts/index.tsx drew before Signal -
 * none of the three is the answer this screen is for, and Today's one filled button is
 * the hero's START, so three more buttons sitting on the screen competing
 * with it is exactly what "at most one filled control" rules out.
 *
 * Drawn on the house BottomSheet, like the picker's facet sheets and account
 * deletion.
 */
const SomethingElseSheet = ({
    visible,
    onClose,
    onStartWithoutPlan,
    onLogPastWorkout,
    onSaveOwnWorkout,
    startDisabled,
}: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    // Closing before acting, not after: the action itself can navigate (Log a
    // past workout, Create a workout template) or open a live session, and a
    // sheet still on screen behind either would have to be dismissed a second
    // time.
    const act = (fn: () => void) => {
        onClose()
        fn()
    }

    const actions = [
        {
            label: 'Start without a plan',
            onPress: () => act(onStartWithoutPlan),
            disabled: startDisabled,
            // The single-active-Session rule (ADR 0003) still holds; a row
            // that simply vanished behind the closing sheet used to look like
            // the tap had done nothing at all.
            caption: startDisabled ? 'Finish or discard your open session first' : undefined,
        },
        { label: 'Log a past workout', onPress: () => act(onLogPastWorkout) },
        { label: 'Create a workout template', onPress: () => act(onSaveOwnWorkout) },
    ]

    return (
        <BottomSheet visible={visible} onClose={onClose}>
            {actions.map((action, i) => (
                <Pressable
                    key={action.label}
                    onPress={action.onPress}
                    disabled={action.disabled}
                    style={({ pressed }) => [
                        styles.row,
                        i > 0 && { borderTopWidth: 1, borderTopColor: theme.lineSoft },
                        pressed && !action.disabled && styles.pressed,
                    ]}
                >
                    <ThemedText variant="body" tone={action.disabled ? 'muted' : 'title'}>
                        {action.label}
                    </ThemedText>
                    {action.caption ? (
                        <ThemedText variant="small" tone="muted">
                            {action.caption}
                        </ThemedText>
                    ) : null}
                </Pressable>
            ))}
            <Pressable onPress={onClose} style={styles.cancel}>
                <ThemedText variant="body" tone="muted">
                    Cancel
                </ThemedText>
            </Pressable>
        </BottomSheet>
    )
}

export default SomethingElseSheet

const styles = StyleSheet.create({
    row: {
        // Nothing interactive under 44px - this much vertical padding clears
        // it with the row's own text sitting centred inside.
        minHeight: 44,
        justifyContent: 'center',
        paddingVertical: Space.lg,
        gap: 2,
    },
    pressed: {
        opacity: 0.6,
    },
    cancel: {
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Space.lg,
    },
})
