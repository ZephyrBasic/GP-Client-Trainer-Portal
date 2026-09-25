import { StyleSheet, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import Pressable from './Touchable'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'

/**
 * "+ Add exercise", drawn the same everywhere it appears.
 *
 * It was an outlined pill on two screens and a green "+ Add Exercise" text
 * link on the other two, so the same action looked like two different weights
 * of thing. Now it is always this pill.
 */
const AddButton = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={[styles.pill, { backgroundColor: theme.uiBackground, borderColor: theme.outline }]}
        >
            <Ionicons name="add" size={16} color={theme.text} />
            <ThemedText variant="meta" tone="body">
                {label}
            </ThemedText>
        </Pressable>
    )
}

export default AddButton

const styles = StyleSheet.create({
    pill: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: Radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.xs,
    },
})
