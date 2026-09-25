import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Pressable from './Touchable'
import { Colors } from '../constants/Colors'
import { NATIVE_DRIVER } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

// The circle is drawn at 30 and tapped at 48: the tap-size decision from the
// UI review was 48 wherever a Client is mid-workout. Real padding rather than
// hitSlop, which react-native-web's Pressable ignores - on the web the old
// "30px plus hitSlop" was a 30px target, and a tap 6px outside it missed.
const CIRCLE = 30
const TARGET = 48

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
    label,
}: {
    value: boolean
    onPress?: () => void
    disabled?: boolean
    tone?: 'accent' | 'amber'
    /** What is being ticked, for a screen reader - "Set 2". */
    label?: string
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
                accessibilityRole="checkbox"
                accessibilityState={{ checked: value, disabled }}
                accessibilityLabel={label}
                style={styles.target}
            >
                <View
                    style={[
                        styles.circle,
                        { borderColor: value ? fill : theme.outline },
                        value && { backgroundColor: fill },
                    ]}
                >
                    {/* Drawn, not typed: a "✓" character took the UI font's
                        own glyph, which in Plex reads as a square root. */}
                    {value ? <Ionicons name="checkmark" size={20} color={theme.background} /> : null}
                </View>
            </Pressable>
        </Animated.View>
    )
}
export default Checkbox

const styles = StyleSheet.create({
    target: {
        width: TARGET,
        height: TARGET,
        borderRadius: TARGET / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    circle: {
        width: CIRCLE,
        height: CIRCLE,
        borderRadius: CIRCLE / 2,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
