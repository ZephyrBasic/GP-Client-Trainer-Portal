import { StyleSheet, View, type ViewProps } from 'react-native'

import ExternalLink from './ExternalLink'
import { PRIVACY_URL, TERMS_URL } from '../utils/links'

/**
 * The privacy policy and terms, side by side.
 *
 * Shown at the point of signup and again on Profile. The signup one is the one
 * that has to work: consent to a policy nobody could read before agreeing is not
 * consent, and these are plain web pages rather than in-app text precisely so
 * they open with no account and no session.
 */
const LegalLinks = ({ style, ...props }: ViewProps) => (
    <View style={[styles.row, style]} {...props}>
        <ExternalLink href={PRIVACY_URL} label="Privacy Policy" variant="meta" />
        <ExternalLink href={TERMS_URL} label="Terms of Service" variant="meta" />
    </View>
)

export default LegalLinks

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
        // Wide enough to read as two links rather than one wrapped sentence, and
        // it wraps on a narrow screen rather than truncating either.
        flexWrap: 'wrap',
        columnGap: 24,
    },
})
