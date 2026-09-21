import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, useColorScheme } from 'react-native'
import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { NATIVE_DRIVER } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

// (44 - 30) / 2: the padding hitSlop needs on each side to bring a 30px
// circle up to the 44pt minimum tap target, without drawing a visibly larger
// circle to get there.
const HIT_SLOP = 7

/**
 * The check-off control: a tap target, not a decoration. Signal draws every
 * interactive mark as a circle or a pill, never a corner, so this is a circle
 * rather than the bordered square it replaces.
 *
 * Ticked, it fills with the accent and the mark is drawn in the screen's own
 * background rather than white. On the dark theme the accent is a bright
 * green that white sits on badly; the page colour reads as a hole punched
 * through the fill, which is legible on both themes.
 *
 * `tone` swaps the fill for `amber` where a ticked Set departed from what it
 * was prescribed - the live Session is the one caller that needs this, to
 * echo the row's own left-edge colour on the control that ticked it.
 */
const Checkbox = ({
    value,
    onPress,
    disabled,
    tone = 'accent',
}: {
    value: boolean
    onPress?: () => void
    disabled?: boolean
    tone?: 'accent' | 'amber'
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const fill = tone === 'amber' ? theme.amber : theme.iconColorFocused
    const reduced = useReducedMotion()

    // A tick lands with a small press-and-release of the circle - the one
    // moment in a Session the thumb is waiting on, so it gets a physical
    // answer. Only on ticking: unticking is a correction, not an event.
    const scale = useRef(new Animated.Value(1)).current
    const previous = useRef(value)
    useEffect(() => {
        const ticked = value && !previous.current
        previous.current = value
        if (!ticked || reduced) return
        scale.setValue(0.82)
        Animated.spring(scale, {
            toValue: 1,
            friction: 4,
            tension: 220,
            useNativeDriver: NATIVE_DRIVER,
        }).start()
    }, [value, reduced, scale])

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                onPress={onPress}
                disabled={disabled}
                hitSlop={HIT_SLOP}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: value }}
                style={[
                    styles.circle,
                    { borderColor: value ? fill : theme.iconColor },
                    value && { backgroundColor: fill },
                ]}
            >
                {value ? (
                    <ThemedText style={[styles.mark, { color: theme.background }]}>✓</ThemedText>
                ) : null}
            </Pressable>
        </Animated.View>
    )
}
export default Checkbox

const styles = StyleSheet.create({
    circle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mark: {
        fontSize: 15,
        fontWeight: 'bold',
    },
})
