import { StyleSheet, TextInput, useColorScheme, type TextInputProps } from 'react-native'
import { Colors } from '../constants/Colors'

const ThemedTextInput = ({ style, ...props }: TextInputProps) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <TextInput
            style={[
                { backgroundColor: theme.uiBackground, color: theme.text, borderColor: theme.iconColor },
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
        borderRadius: 5,
        padding: 12,
        fontSize: 16,
        width: '100%',
    }
})
