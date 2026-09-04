import { Modal, Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'

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
 * next time. One sheet behind a dashed "Something else" row, replacing the
 * three ghost buttons workouts/index.tsx drew before Signal - none of the
 * three is the answer this screen is for, and Today's one filled button is
 * the hero's START, so three more buttons sitting on the screen competing
 * with it is exactly what "at most one filled control" rules out.
 *
 * A plain RN Modal rather than a sheet library, matching the house pattern in
 * ExercisePicker.tsx - transparent and bottom-anchored here instead of a full
 * page, but the same backdrop/insets handling, because three rows and a
 * cancel button don't earn a new dependency.
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
    const insets = useSafeAreaInsets()

    // Closing before acting, not after: the action itself can navigate (Log a
    // past workout, Save a workout of your own) or open a live session, and a
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
        { label: 'Save a workout of your own', onPress: () => act(onSaveOwnWorkout) },
    ]

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                {/* Swallows the backdrop's onPress so tapping the sheet itself
                    doesn't also close through it a frame later. */}
                <Pressable
                    style={[
                        styles.sheet,
                        { backgroundColor: theme.navBackground, paddingBottom: insets.bottom + Space.lg },
                    ]}
                    onPress={() => {}}
                >
                    <View style={[styles.grabber, { backgroundColor: theme.line }]} />
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
                </Pressable>
            </Pressable>
        </Modal>
    )
}

export default SomethingElseSheet

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: Radius.hero,
        borderTopRightRadius: Radius.hero,
        paddingTop: Space.sm,
        paddingHorizontal: Space.xl,
    },
    grabber: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: Radius.rail,
        marginBottom: Space.md,
    },
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
