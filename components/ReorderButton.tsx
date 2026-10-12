import { StyleSheet, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import Pressable from './Touchable'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { FontFamily } from '../constants/Type'

/**
 * Switches an Exercise list between editing its Sets and putting the
 * Exercises in order (components/ExerciseReorderList). A quiet accent link
 * rather than a pill: it sits on the same line as the list's heading, and the
 * pills below it are the list's own actions.
 */
const ReorderButton = ({
    reordering,
    onPress,
    disabled,
}: {
    reordering: boolean
    onPress: () => void
    disabled?: boolean
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            hitSlop={Space.sm}
            accessibilityLabel={reordering ? 'Done reordering' : 'Reorder exercises'}
            style={styles.button}
        >
            <Ionicons name={reordering ? 'checkmark' : 'swap-vertical'} size={16} color={theme.iconColorFocused} />
            <ThemedText tone="accent" style={styles.label}>
                {reordering ? 'Done' : 'Reorder'}
            </ThemedText>
        </Pressable>
    )
}

export default ReorderButton

const styles = StyleSheet.create({
    button: {
        minHeight: 32,
        paddingHorizontal: Space.sm,
        borderRadius: Radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.xs,
    },
    label: {
        fontFamily: FontFamily.label,
        fontSize: 13,
    },
})
