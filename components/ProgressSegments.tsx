import { StyleSheet, View, useColorScheme, type ViewProps } from 'react-native'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'

/**
 * Discrete progress, for counts a fraction bar would blur together - "1 of 3
 * this week" reads as three distinct segments, not one bar a third full.
 * `filled` counts from the start; there is no notion of a partial segment.
 */
const ProgressSegments = ({
    total,
    filled,
    style,
    ...props
}: ViewProps & { total: number; filled: number }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <View style={[styles.row, style]} {...props}>
            {Array.from({ length: total }, (_, i) => (
                <View
                    key={i}
                    style={[
                        styles.segment,
                        { backgroundColor: i < filled ? theme.iconColorFocused : theme.lineSoft },
                    ]}
                />
            ))}
        </View>
    )
}
export default ProgressSegments

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: Space.xs,
    },
    segment: {
        flex: 1,
        height: 4,
        borderRadius: Radius.rail,
    },
})
