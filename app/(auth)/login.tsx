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

const Login = () => {
    const { signIn } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleLogin = async () => {
        setError('')

        if (!email.trim() || !password) {
            setError('Please enter your email and password.')
            return
        }

        setSubmitting(true)
        try {
            await signIn(email.trim(), password)
            // Successful sign-in flips the auth state; the root layout's route
            // guard takes it from here.
        } catch (err) {
            setError(getAuthErrorMessage(err))
            setSubmitting(false)
        }
    }

    return (
        <ThemedView style={styles.container}>
            <Spacer />
            <ThemedText variant="title" tone="title" style={styles.title}>
                Login to your account
            </ThemedText>

            <Spacer height={Space.xl} />

            <ThemedText variant="label" tone="muted" style={styles.label}>
                Email
            </ThemedText>
            <ThemedTextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                editable={!submitting}
            />

            <Spacer height={Space.lg} />
            <ThemedText variant="label" tone="muted" style={styles.label}>
                Password
            </ThemedText>
            <ThemedTextInput value={password} onChangeText={setPassword} secureTextEntry editable={!submitting} />

            {error ? (
                <>
                    <Spacer height={Space.lg} />
                    <ThemedText variant="body" tone="danger">
                        {error}
                    </ThemedText>
                </>
            ) : null}

            <Spacer height={Space.xl} />
            <ThemedButton onPress={handleLogin} disabled={submitting}>
                <ThemedText variant="cardTitle" tone="onPrimary">
                    {submitting ? 'Logging in...' : 'Login'}
                </ThemedText>
            </ThemedButton>

            {/* Above "Register" rather than below it: the person who needs this
                link has an account and is stuck, which is a worse place to be
                than not having one yet. */}
            <Spacer height={Space.lg} />
            <Link href="/forgot-password" style={styles.link}>
                <ThemedText variant="meta" tone="accent">
                    Forgot your password?
                </ThemedText>
            </Link>

            <Spacer height={Space.lg} />
            <Link href="/register" style={styles.link}>
                <ThemedText variant="body" tone="accent">
                    Need an account? Register
                </ThemedText>
            </Link>
        </ThemedView>
    )
}

export default Login

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
