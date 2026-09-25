import { StyleSheet, View, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import Pressable from './Touchable'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'

/**
 * Pick one of a few options: Material's segmented button.
 *
 * Register's Client/Trainer choice used to be two pills, the chosen one
 * filled exactly like the Register button below it - so the screen seemed to
 * have two main buttons, and nothing said only one could be picked. One
 * outlined bar with a tinted, ticked segment says both.
 */
const SegmentedControl = <T extends string>({
    options,
    value,
    onChange,
    disabled,
    label,
}: {
    options: { value: T; label: string }[]
    value: T
    onChange: (value: T) => void
    disabled?: boolean
    /** What is being chosen, for a screen reader. */
    label: string
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.bar, { borderColor: theme.outline }]}>
            {options.map((option, i) => {
                const selected = option.value === value
                return (
                    <Pressable
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        disabled={disabled}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        style={[
                            styles.segment,
                            i > 0 && { borderLeftWidth: 1, borderLeftColor: theme.outline },
                            selected && { backgroundColor: theme.accentTint },
                        ]}
                    >
                        {selected ? <Ionicons name="checkmark" size={16} color={theme.iconColorFocused} /> : null}
                        <ThemedText variant="body" tone={selected ? 'accent' : 'body'} style={selected && styles.selected}>
                            {option.label}
                        </ThemedText>
                    </Pressable>
                )
            })}
        </View>
    )
}

export default SegmentedControl

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: Radius.pill,
        overflow: 'hidden',
    },
    segment: {
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.xs,
    },
    selected: {
        fontWeight: '600',
    },
})
