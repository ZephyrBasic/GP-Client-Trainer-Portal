import { Linking, Pressable, StyleSheet } from 'react-native'

import ThemedText from './ThemedText'
import type { TextVariant } from './ThemedText'

type Props = {
    /** Any scheme Linking can open - https: and mailto: are the two used here. */
    href: string
    label: string
    variant?: TextVariant
}

/**
 * A tappable line of text that leaves the app.
 *
 * expo-router's `Link` is for routes inside it; handing that an https: URL means
 * relying on the router to notice and bail out to the platform, which it does
 * differently per platform and not at all for mailto:. One `Linking.openURL` in
 * one component instead, so the legal links, the feedback mail and the crash
 * screen's "email us" all fail the same way.
 *
 * And they can fail: a device with no mail client rejects a mailto:, and a
 * kiosked browser can refuse a new tab. Swallowed rather than crashed - a link
 * that does nothing is a disappointment, one that throws inside the error
 * boundary's own recovery screen is a loop.
 */
const ExternalLink = ({ href, label, variant = 'body' }: Props) => (
    <Pressable
        onPress={() => Linking.openURL(href).catch(() => {})}
        style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
        accessibilityRole="link"
    >
        <ThemedText variant={variant} tone="accent">
            {label}
        </ThemedText>
    </Pressable>
)

export default ExternalLink

const styles = StyleSheet.create({
    hit: {
        // Nothing interactive under 44px - the same floor SomethingElseSheet's
        // rows clear, reached here with vertical padding since the label itself
        // is one short line.
        minHeight: 44,
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.6,
    },
})
