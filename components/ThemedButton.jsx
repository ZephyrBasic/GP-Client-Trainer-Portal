import { Pressable, StyleSheet } from 'react-native'
import { Colors } from '../constants/Colors'

const ThemedButton = ({ style, disabled, ...props }) => {
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
