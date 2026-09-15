import { useState } from 'react'
import { StyleSheet } from 'react-native'
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

    const handleSend = async () => {
        setError('')

        if (!email.trim()) {
            setError('Please enter your email address.')
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
            <Spacer />
            <ThemedText variant="title" tone="title" style={styles.title}>
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
                    <ThemedText variant="label" tone="muted" style={styles.label}>
                        Email
                    </ThemedText>
                    <ThemedTextInput
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!submitting}
                    />

                    {error ? (
                        <>
                            <Spacer height={Space.lg} />
                            <ThemedText variant="body" tone="danger">
                                {error}
                            </ThemedText>
                        </>
                    ) : null}

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
                    Back to login
                </ThemedText>
            </Link>
        </ThemedView>
    )
}

export default ForgotPassword

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: Space.xl,
    },
    title: {
        textAlign: 'center',
        marginBottom: Space.sm,
    },
    label: {
        marginBottom: Space.sm,
    },
    link: {
        textAlign: 'center',
    },
})
