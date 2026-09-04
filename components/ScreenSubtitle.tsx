import { StyleSheet, type TextProps } from 'react-native'

import ThemedText from './ThemedText'
import { Space } from '../constants/Layout'

/**
 * One line under the native header saying what this screen is looking at.
 *
 * "3 templates · 4 clients", "2 prescribed · 1 of your own", "Version 7 · in
 * progress". Titles come from `Stack.Screen options` and name the *kind* of
 * screen; this names the particular one you are on, which is the thing a title
 * cannot do without becoming a sentence.
 *
 * A band at the top of the screen body rather than a subtitle inside the header:
 * taking over the header would mean `headerShown: false` on every route in the
 * stack and hand-drawn back buttons across all of them, which is a great deal of
 * navigation code for one line of text.
 *
 * Extends TextProps rather than redeclaring style, so a screen with its own
 * header - the live Session - can drop the bottom margin without a second
 * component.
 */
const ScreenSubtitle = ({ style, ...props }: TextProps) => (
    <ThemedText variant="meta" tone="muted" style={[styles.subtitle, style]} {...props} />
)

export default ScreenSubtitle

const styles = StyleSheet.create({
    subtitle: {
        marginBottom: Space.md,
    },
})
