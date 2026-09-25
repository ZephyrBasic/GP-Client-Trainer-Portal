import { StyleSheet, useColorScheme, type StyleProp, type ViewStyle } from 'react-native'
import Pressable from './Touchable'
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
 * The app's one back control: every Stack header uses it (hooks/useHeaderOptions),
 * and so do the two screens that draw their own header - a live Session and a
 * Trainer's Client.
 *
 * A bare chevron in a 48px circle. 48 rather than 44 because the live Session
 * is one of its homes, and the tap-size decision (UI review, issue 5) was 48
 * wherever a Client is mid-workout. Real size, not hitSlop: react-native-web's
 * Pressable ignores hitSlop, so the 36px pill this replaced was 36px on the web.
 */
const BackPill = ({ onPress, style, label }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[styles.hit, style]}
        >
            <Ionicons name="chevron-back" size={24} color={theme.title} />
        </Pressable>
    )
}

export default BackPill

const styles = StyleSheet.create({
    hit: {
        width: 48,
        height: 48,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
