import { StyleSheet, TextInput, useColorScheme, type TextInputProps } from 'react-native'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { Type } from '../constants/Type'

const ThemedTextInput = ({ style, ...props }: TextInputProps) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <TextInput
            style={[
                Type.body,
                // A hairline, not an icon-strength border: this outline is the
                // same weight as every other surface edge, not a control calling
                // attention to itself.
                { backgroundColor: theme.uiBackground, color: theme.text, borderColor: theme.line },
                styles.input,
                style,
            ]}
            placeholderTextColor={theme.iconColor}
            autoCapitalize="none"
            {...props}
        />
    )
}
export default ThemedTextInput

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        borderRadius: Radius.card,
        padding: Space.md,
        width: '100%',
    }
})
