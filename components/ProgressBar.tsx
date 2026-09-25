import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, useColorScheme, type ViewProps } from 'react-native'
import { Colors } from '../constants/Colors'
import { Radius } from '../constants/Layout'
import { Duration, Ease } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * A single fraction bar - the running "3 of 11 sets" fill on a live session
 * header. `value` is the caller's own fraction, clamped here rather than
 * trusted, since a set count in flight can briefly overshoot 1 between two
 * writes settling.
 *
 * The fill slides to a new fraction rather than jumping to it: ticking a Set
 * off is the one thing this bar ever reports, and a bar that slides says a
 * Set was counted where a bar that snaps says the screen was redrawn. It
 * animates from empty on mount for the same reason - a Session opens at zero
 * and fills as it is performed.
 *
 * Width is a percentage, so this is the one animation here that cannot take the
 * native driver (which handles transforms and opacity only). It is four pixels
 * tall and moves a few times a minute.
 */
const ProgressBar = ({ value, style, ...props }: ViewProps & { value: number }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const reduced = useReducedMotion()
    const pct = Math.max(0, Math.min(1, value))
    const fill = useRef(new Animated.Value(0)).current

    useEffect(() => {
        if (reduced) {
            fill.setValue(pct)
            return
        }
        Animated.timing(fill, {
            toValue: pct,
            duration: Duration.base,
            easing: Ease.out,
            useNativeDriver: false,
        }).start()
    }, [pct, reduced, fill])

    const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

    return (
        <View style={[styles.track, { backgroundColor: theme.lineSoft }, style]} {...props}>
            <Animated.View style={[styles.fill, { backgroundColor: theme.iconColorFocused, width }]} />
        </View>
    )
}
export default ProgressBar

const styles = StyleSheet.create({
    track: {
        height: 4,
        borderRadius: Radius.rail,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: Radius.rail,
    },
})
