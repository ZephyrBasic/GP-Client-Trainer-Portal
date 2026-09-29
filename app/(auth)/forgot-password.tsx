import { useRef, useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { Link } from 'expo-router'

// themed components
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedTextInput from '../../components/ThemedTextInput'
import ThemedButton from '../../components/ThemedButton'
import Spacer from '../../components/Spacer'

import { Space } from '../../constants/Layout'
import { useAuth } from '../../contexts/AuthContext'
import { getAuthErrorMessage } from '../../utils/firebaseErrors'
import { looksLikeEmail } from '../../utils/email'
import FieldLabel from '../../components/FieldLabel'

/**
 * The way back in for someone who mistyped a password once.
 *
 * The success copy says "if that address has an account" and never "we've sent
 * you an email", and that wording is load-bearing rather than cautious. With
 * email-enumeration protection enabled - which it should be - Firebase resolves
 * this call successfully for an address that has no account at all, precisely so
 * the response cannot be used to discover who has one. Copy that promised an
 * email would then be a lie in the one case where the user most needs to know
 * the truth, and would hand the enumeration back that the setting removed.
 */
const ForgotPassword = () => {
    const { resetPassword } = useAuth()

    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [sent, setSent] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const emailRef = useRef<TextInput>(null)

    const handleSend = async () => {
        setError('')

        if (!email.trim() || !looksLikeEmail(email)) {
            setError(email.trim() ? "That isn't an email address." : 'Enter your email.')
            emailRef.current?.focus()
            return
        }

        setSubmitting(true)
        try {
            await resetPassword(email)
            setSent(true)
        } catch (err) {
            setError(getAuthErrorMessage(err))
        }
        setSubmitting(false)
    }

    return (
        <ThemedView style={styles.container}>
            <ThemedText variant="title" tone="title" role="heading">
                Reset your password
            </ThemedText>

            <Spacer height={Space.xl} />

            {sent ? (
                <>
                    <ThemedText variant="body" tone="body">
                        If that address has a GreenPulse account, a reset link is on its way to it. The
                        link expires after an hour, and it can land in spam.
                    </ThemedText>
                    <Spacer height={Space.lg} />
                    <ThemedText variant="body" tone="muted">
                        Still nothing after a few minutes? Check you typed the address you registered
                        with, and try again.
                    </ThemedText>
                    <Spacer height={Space.xl} />
                    <ThemedButton onPress={() => setSent(false)} variant="ghost">
                        <ThemedText variant="cardTitle" tone="body">
                            Try another address
                        </ThemedText>
                    </ThemedButton>
                </>
            ) : (
                <>
                    <ThemedText variant="body" tone="muted">
                        Enter the email you registered with and we'll send you a link to set a new
                        password.
                    </ThemedText>

                    <Spacer height={Space.lg} />
                    <FieldLabel error={error}>Email</FieldLabel>
                    <ThemedTextInput
                        ref={emailRef}
                        accessibilityLabel="Email"
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text)
                            setError('')
                        }}
                        keyboardType="email-address"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        returnKeyType="send"
                        onSubmitEditing={handleSend}
                        invalid={Boolean(error)}
                        editable={!submitting}
                    />

                    <Spacer height={Space.xl} />
                    <ThemedButton onPress={handleSend} disabled={submitting}>
                        <ThemedText variant="cardTitle" tone="onPrimary">
                            {submitting ? 'Sending...' : 'Send reset link'}
                        </ThemedText>
                    </ThemedButton>
                </>
            )}

            <Spacer height={Space.xl} />
            <Link href="/login" style={styles.link}>
                <ThemedText variant="body" tone="accent">
                    Back to log in
                </ThemedText>
            </Link>
        </ThemedView>
    )
}

export default ForgotPassword

const styles = StyleSheet.create({
    // Top- and left-aligned, like the rest of the app.
    container: {
        flex: 1,
        paddingHorizontal: Space.lg,
        paddingTop: 80,
    },
    label: {
        marginBottom: Space.sm,
    },
    link: {
        paddingVertical: Space.md,
    },
})
