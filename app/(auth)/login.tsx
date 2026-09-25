import { useRef, useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { Link } from 'expo-router'

// themed components
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedTextInput from '../../components/ThemedTextInput'
import ThemedButton from '../../components/ThemedButton'
import PasswordField from '../../components/PasswordField'
import FieldError from '../../components/FieldError'
import Spacer from '../../components/Spacer'

import { Space } from '../../constants/Layout'
import { useAuth } from '../../contexts/AuthContext'
import { looksLikeEmail } from '../../utils/email'
import { getAuthErrorMessage } from '../../utils/firebaseErrors'

const Login = () => {
    const { signIn } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    // Per field, under the field, all at once (.claude/rules/ui.md). `form` is
    // Firebase's answer, which is about the pair rather than either box.
    const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
    const [submitting, setSubmitting] = useState(false)
    const emailRef = useRef<TextInput>(null)
    const passwordRef = useRef<TextInput>(null)

    const handleLogin = async () => {
        const found = {
            email: !email.trim() ? 'Enter your email.' : !looksLikeEmail(email) ? "That doesn't look like an email address." : undefined,
            password: !password ? 'Enter your password.' : undefined,
        }
        setErrors(found)
        if (found.email) return emailRef.current?.focus()
        if (found.password) return passwordRef.current?.focus()

        setSubmitting(true)
        try {
            await signIn(email.trim(), password)
            // Successful sign-in flips the auth state; the root layout's route
            // guard takes it from here.
        } catch (err) {
            setErrors({ form: getAuthErrorMessage(err) })
            setSubmitting(false)
        }
    }

    // Left-aligned like every other screen, and top-weighted rather than
    // vertically centred, so an error appearing never shoves the whole block.
    return (
        <ThemedView style={styles.container}>
            <ThemedText variant="title" tone="title" role="heading">
                Log in
            </ThemedText>

            <Spacer height={Space.xl} />

            <ThemedText variant="meta" tone="muted" style={styles.label}>
                Email
            </ThemedText>
            {/* Labelled, typed and autocompleted so the phone offers the email
                keyboard and a password manager can pair the two boxes. Enter
                moves on, then signs in. */}
            <ThemedTextInput
                ref={emailRef}
                accessibilityLabel="Email"
                value={email}
                onChangeText={(text) => {
                    setEmail(text)
                    setErrors((prev) => ({ ...prev, email: undefined, form: undefined }))
                }}
                keyboardType="email-address"
                inputMode="email"
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                invalid={Boolean(errors.email)}
                editable={!submitting}
            />
            <FieldError>{errors.email}</FieldError>

            <Spacer height={Space.lg} />
            <ThemedText variant="meta" tone="muted" style={styles.label}>
                Password
            </ThemedText>
            <PasswordField
                inputRef={passwordRef}
                accessibilityLabel="Password"
                value={password}
                onChangeText={(text) => {
                    setPassword(text)
                    setErrors((prev) => ({ ...prev, password: undefined, form: undefined }))
                }}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                invalid={Boolean(errors.password)}
                editable={!submitting}
            />
            <FieldError>{errors.password}</FieldError>
            <FieldError>{errors.form}</FieldError>

            <Spacer height={Space.xl} />
            <ThemedButton onPress={handleLogin} disabled={submitting}>
                <ThemedText variant="cardTitle" tone="onPrimary">
                    {submitting ? 'Logging in...' : 'Log in'}
                </ThemedText>
            </ThemedButton>

            {/* Above "Register" rather than below it: the person who needs this
                link has an account and is stuck, which is a worse place to be
                than not having one yet. */}
            <Spacer height={Space.md} />
            <Link href="/forgot-password" style={styles.link}>
                <ThemedText variant="body" tone="accent">
                    Forgot your password?
                </ThemedText>
            </Link>
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
        paddingHorizontal: Space.xl,
        paddingTop: 96,
    },
    label: {
        marginBottom: Space.sm,
    },
    // 44 tall: these were 15px lines of text to aim at.
    link: {
        paddingVertical: Space.md,
    },
})
