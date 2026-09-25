import { StyleSheet } from 'react-native'
import ThemedText from './ThemedText'
import { Space } from '../constants/Layout'

/**
 * A form error, drawn directly under the field it is about.
 *
 * Errors used to collect in one line near the Save button, far from the field
 * at fault and often off-screen with it; this is the one place they are drawn
 * now, so every form says what is wrong in the same colour and the same spot.
 * `accessibilityLiveRegion` makes a screen reader announce it as it appears.
 */
const FieldError = ({ children }: { children?: string | null }) =>
    children ? (
        <ThemedText
            variant="meta"
            tone="danger"
            style={styles.text}
            accessibilityLiveRegion="polite"
            role="alert"
        >
            {children}
        </ThemedText>
    ) : null

export default FieldError

const styles = StyleSheet.create({
    text: {
        marginTop: Space.xs + 2,
    },
})
