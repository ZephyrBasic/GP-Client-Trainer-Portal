import { useState, type Ref } from 'react'
import { StyleSheet, TextInput, useColorScheme, type TextInputProps } from 'react-native'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { Type } from '../constants/Type'

type Props = TextInputProps & {
    /** React 19 passes refs as a prop; typed here so a form can focus a bad field. */
    ref?: Ref<TextInput>
    /** Outline in danger while its field has an error. */
    invalid?: boolean
}

const ThemedTextInput = ({ style, invalid, onFocus, onBlur, ...props }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const [focused, setFocused] = useState(false)

    // `outline`, not the `line` hairline: a box you type into is a control,
    // and its edge has to clear 3:1 against the page (WCAG 1.4.11) - `line`
    // was 1.4:1, so empty fields read as faint shapes. Focus thickens it in
    // the accent, which replaces the browser's black rectangle.
    const borderColor = invalid ? theme.danger : focused ? theme.iconColorFocused : theme.outline

    return (
        <TextInput
            style={[
                Type.body,
                { backgroundColor: theme.uiBackground, color: theme.text, borderColor },
                styles.input,
                focused && styles.focused,
                style,
            ]}
            placeholderTextColor={theme.iconColor}
            autoCapitalize="none"
            onFocus={(e) => {
                setFocused(true)
                onFocus?.(e)
            }}
            onBlur={(e) => {
                setFocused(false)
                onBlur?.(e)
            }}
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
        minHeight: 44,
        width: '100%',
    },
    // One pixel more border, one less padding, so focusing never shifts text.
    focused: {
        borderWidth: 2,
        padding: Space.md - 1,
        // RN-web only; ignored on native.
        outlineStyle: 'none',
    } as object,
})
