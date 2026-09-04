import { StyleSheet, View, useColorScheme, type ViewProps } from 'react-native'
import { Colors } from '../constants/Colors'
import { Radius } from '../constants/Layout'

/**
 * A single fraction bar - the running "3 of 11 sets" fill on a live session
 * header. `value` is the caller's own fraction, clamped here rather than
 * trusted, since a set count in flight can briefly overshoot 1 between two
 * writes settling.
 */
const ProgressBar = ({ value, style, ...props }: ViewProps & { value: number }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const pct = Math.max(0, Math.min(1, value))

    return (
        <View style={[styles.track, { backgroundColor: theme.lineSoft }, style]} {...props}>
            <View
                style={[styles.fill, { backgroundColor: theme.iconColorFocused, width: `${pct * 100}%` }]}
            />
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
