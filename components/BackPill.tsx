import { Pressable, StyleSheet, useColorScheme, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Colors } from '../constants/Colors'
import { Radius } from '../constants/Layout'

type Props = {
    onPress: () => void
    style?: StyleProp<ViewStyle>
    /** What it leaves, for a screen reader - "Back to Today". */
    label: string
}

/**
 * The back control for the two screens that draw their own header instead of
 * the Stack's - a live Session and a Trainer's Client.
 *
 * Top left, where the Stack's own arrow is, because a Client should not have
 * to look for it in a different corner on every screen; the live Session used
 * to keep it in the footer beside FINISH. A pill rather than React
 * Navigation's bare chevron, since these headers have no bar behind them for a
 * bare arrow to sit on.
 */
const BackPill = ({ onPress, style, label }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Pressable
            onPress={onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[styles.pill, { backgroundColor: theme.uiBackground, borderColor: theme.line }, style]}
        >
            <Ionicons name="chevron-back" size={17} color={theme.text} />
        </Pressable>
    )
}

export default BackPill

const styles = StyleSheet.create({
    pill: {
        width: 36,
        height: 36,
        borderRadius: Radius.pill,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
