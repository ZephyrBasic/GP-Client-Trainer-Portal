import { useState, type Ref } from 'react'
import { StyleSheet, TextInput, View, useColorScheme, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import ThemedTextInput from './ThemedTextInput'
import Pressable from './Touchable'
import { Colors } from '../constants/Colors'
import { Radius } from '../constants/Layout'

/**
 * A password box with a show/hide eye. On a phone keyboard a password is easy
 * to mistype and impossible to check without one.
 */
const PasswordField = ({ inputRef, ...props }: TextInputProps & { inputRef?: Ref<TextInput>; invalid?: boolean }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const [visible, setVisible] = useState(false)

    return (
        <View>
            <ThemedTextInput ref={inputRef} secureTextEntry={!visible} style={styles.input} {...props} />
            <Pressable
                onPress={() => setVisible((prev) => !prev)}
                accessibilityLabel={visible ? 'Hide password' : 'Show password'}
                style={styles.eye}
            >
                <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.iconColor} />
            </Pressable>
        </View>
    )
}

export default PasswordField

const styles = StyleSheet.create({
    input: {
        paddingRight: 52,
    },
    eye: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 48,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
