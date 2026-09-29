import { StyleSheet, View } from 'react-native'
import ThemedText from './ThemedText'
import { Space } from '../constants/Layout'

/**
 * A field's label, with its error on the same line.
 *
 * For the sign-in screens, where the error can't go under the box: iOS draws
 * its "Fill password" / "Fill email" bubble directly beneath a focused field,
 * right over it. On the label line it is never covered, and appearing or
 * clearing it moves nothing - the box stays put under the thumb.
 */
const FieldLabel = ({ children, error }: { children: string; error?: string | null }) => (
    <View style={styles.row}>
        <ThemedText variant="meta" tone="muted">
            {children}
        </ThemedText>
        {error ? (
            <ThemedText
                variant="meta"
                tone="danger"
                style={styles.error}
                accessibilityLiveRegion="polite"
                role="alert"
            >
                {error}
            </ThemedText>
        ) : null}
    </View>
)

export default FieldLabel

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: Space.md,
        marginBottom: Space.sm,
    },
    error: {
        flexShrink: 1,
        textAlign: 'right',
    },
})
