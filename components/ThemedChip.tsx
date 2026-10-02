import { StyleSheet, View, useColorScheme, type ViewProps } from 'react-native'

import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { Radius } from '../constants/Layout'

/**
 * What a chip is saying about the thing it sits on.
 *
 *   accent  a good state, or a plain fact about the current thing - As
 *           Prescribed
 *   amber   worth a look, not wrong - Modified
 *   muted   a state with no charge either way - Self-directed
 *
 * Deliberately three, and deliberately not a colour prop. A caller passing a
 * colour would be deciding what the chip *means* at the call site, which is how
 * "Modified" came to be drawn in a neutral grey that said nothing at all.
 */
export type ChipTone = 'accent' | 'amber' | 'muted'

/**
 * A small label naming a state or a fact, on the row it belongs to.
 *
 * Tinted rather than filled: a wash of the colour at low alpha behind the colour
 * itself (see the `*Tint` tokens). A solid fill would need white text on one
 * theme's colour and dark text on the other's, and four solid chips down a list
 * shout in a way this design does not.
 *
 * Uppercase micro-type, because a chip is a label and not a sentence - it has to
 * read as a marker at a glance beside a name set three sizes larger. A label
 * that is already a token and looks wrong spaced out can pass `uppercase={false}`.
 */
const ThemedChip = ({
    label,
    tone = 'accent',
    uppercase = true,
    style,
    ...props
}: ViewProps & { label: string; tone?: ChipTone; uppercase?: boolean }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const [tint, ink] =
        tone === 'amber'
            ? [theme.amberTint, theme.amber]
            : tone === 'muted'
              ? [theme.mutedTint, theme.iconColor]
              : [theme.accentTint, theme.iconColorFocused]

    return (
        <View style={[styles.chip, { backgroundColor: tint }, style]} {...props}>
            <ThemedText style={[styles.label, uppercase ? styles.caps : styles.tight, { color: ink }]}>
                {uppercase ? label.toUpperCase() : label}
            </ThemedText>
        </View>
    )
}

export default ThemedChip

const styles = StyleSheet.create({
    chip: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        // Signal draws chips as pills, alongside checkboxes and secondary
        // buttons - the roundness ladder's other end from the raised card.
        borderRadius: Radius.pill,
        alignSelf: 'flex-start',
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
    },
    caps: {
        letterSpacing: 0.7,
    },
    tight: {
        letterSpacing: 0.4,
    },
})
