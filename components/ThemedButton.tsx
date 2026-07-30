import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { Colors } from '../constants/Colors'

// `style` is narrowed to a plain style object rather than Pressable's
// style-or-callback union: this component already owns the callback form in
// order to fold in the pressed/disabled states, and callers only ever append.
type ThemedButtonProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }

const ThemedButton = ({ style, disabled, ...props }: ThemedButtonProps) => {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.btn,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
                style,
            ]}
            disabled={disabled}
            {...props}
        />
    )
}
export default ThemedButton

const styles = StyleSheet.create({
    btn: {
        backgroundColor: Colors.primary,
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
        width: '100%',
    },
    pressed: {
        opacity: 0.8,
    },
    disabled: {
        opacity: 0.5,
    },
})
