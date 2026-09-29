import { useRef, useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { Link } from 'expo-router'

// themed components
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedTextInput from '../../components/ThemedTextInput'
import ThemedButton from '../../components/ThemedButton'
import PasswordField from '../../components/PasswordField'
import FieldLabel from '../../components/FieldLabel'
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
    // Per field, all at once (.claude/rules/ui.md), drawn on the label line -
    // see components/FieldLabel for why not under the box. `form` is
    // Firebase's answer, which is about the pair rather than either box.
    const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
    const [submitting, setSubmitting] = useState(false)
    const emailRef = useRef<TextInput>(null)
    const passwordRef = useRef<TextInput>(null)

    // Takes the values rather than reading state, so an autofill (below) can
    // log in with what it just filled before state has caught up.
    const handleLogin = async (emailValue = email, passwordValue = password) => {
        if (submitting) return
        const found = {
            email: !emailValue.trim()
                ? 'Enter your email.'
                : !looksLikeEmail(emailValue)
                  ? "That isn't an email address."
                  : undefined,
            password: !passwordValue ? 'Enter your password.' : undefined,
        }
        setErrors(found)
        if (found.email) return emailRef.current?.focus()
        if (found.password) return passwordRef.current?.focus()

        setSubmitting(true)
        try {
            await signIn(emailValue.trim(), passwordValue)
            // Successful sign-in flips the auth state; the root layout's route
            // guard takes it from here.
        } catch (err) {
            setErrors({ form: getAuthErrorMessage(err) })
            setSubmitting(false)
        }
    }

    const changePassword = (text: string) => {
        // A whole password arriving in one change is a password manager
        // filling it - nobody types six characters in one keystroke - and
        // someone who picked their saved login wants to be logged in, not to
        // find the Log in button afterwards.
        const filled = text.length - password.length > 1 && text.length >= 6
        setPassword(text)
        setErrors((prev) => ({ ...prev, password: undefined, form: undefined }))
        if (filled && looksLikeEmail(email)) handleLogin(email, text)
    }

    return (
        <ThemedView style={styles.container}>
            <ThemedText variant="title" tone="title" role="heading">
                Log in
            </ThemedText>

            <Spacer height={Space.lg} />

            <FieldLabel error={errors.email}>Email</FieldLabel>
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

            <Spacer height={Space.md} />
            <FieldLabel error={errors.password}>Password</FieldLabel>
            <PasswordField
                inputRef={passwordRef}
                accessibilityLabel="Password"
                value={password}
                onChangeText={changePassword}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => handleLogin()}
                invalid={Boolean(errors.password)}
                editable={!submitting}
            />
            {/* Firebase's answer comes back after the keyboard is down, so
                under the box is safe for this one. */}
            <FieldError>{errors.form}</FieldError>

            <Spacer height={Space.lg} />
            <ThemedButton onPress={() => handleLogin()} disabled={submitting}>
                <ThemedText variant="cardTitle" tone="onPrimary">
                    {submitting ? 'Logging in...' : 'Log in'}
                </ThemedText>
            </ThemedButton>

            {/* Above "Register" rather than below it: the person who needs this
                link has an account and is stuck, which is a worse place to be
                than not having one yet. */}
            <Spacer height={Space.sm} />
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
        paddingHorizontal: Space.lg,
        paddingTop: 80,
    },
    // 44 tall: these were 15px lines of text to aim at.
    link: {
        paddingVertical: Space.md,
    },
})
