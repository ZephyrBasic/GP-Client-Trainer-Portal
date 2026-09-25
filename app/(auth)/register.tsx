import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, TextInput } from 'react-native'
import { Link } from 'expo-router'

// themed components
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedTextInput from '../../components/ThemedTextInput'
import ThemedButton from '../../components/ThemedButton'
import PasswordField from '../../components/PasswordField'
import SegmentedControl from '../../components/SegmentedControl'
import FieldError from '../../components/FieldError'
import LegalLinks from '../../components/LegalLinks'
import Spacer from '../../components/Spacer'

import { Space } from '../../constants/Layout'
import { useAuth } from '../../contexts/AuthContext'
import { looksLikeEmail } from '../../utils/email'
import { getAuthErrorMessage } from '../../utils/firebaseErrors'

// Firebase's own floor. Said up front, under the box, rather than discovered
// as an error after pressing Register.
const MIN_PASSWORD = 6

type Field = 'name' | 'email' | 'password' | 'code' | 'form'

const Register = () => {
    const { signUp } = useAuth()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState<'client' | 'trainer'>('client')
    const [inviteCode, setInviteCode] = useState('')
    const [trainerCode, setTrainerCode] = useState('')
    const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
    const [submitting, setSubmitting] = useState(false)
    const nameRef = useRef<TextInput>(null)
    const emailRef = useRef<TextInput>(null)
    const passwordRef = useRef<TextInput>(null)
    const codeRef = useRef<TextInput>(null)

    const clear = (field: Field) => setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))

    const handleRegister = async () => {
        const code = role === 'client' ? inviteCode.trim() : trainerCode.trim()
        const found: Partial<Record<Field, string>> = {
            name: name.trim() ? undefined : 'Enter your name.',
            email: !email.trim() ? 'Enter your email.' : !looksLikeEmail(email) ? "That doesn't look like an email address." : undefined,
            password: password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : undefined,
            // Only that it is present. Whether it is *right* is a question only
            // firestore.rules can answer, because the code is deliberately not
            // readable by this app - see AuthContext.signUp.
            code: code ? undefined : role === 'client' ? "Enter your trainer's invite code." : 'Enter the trainer signup code.',
        }
        setErrors(found)
        const first = (['name', 'email', 'password', 'code'] as const).find((field) => found[field])
        if (first) {
            return { name: nameRef, email: emailRef, password: passwordRef, code: codeRef }[first].current?.focus()
        }

        setSubmitting(true)
        try {
            await signUp(email.trim(), password, {
                name: name.trim(),
                role,
                inviteCode: inviteCode.trim(),
                trainerCode: trainerCode.trim(),
            })
            // Successful sign-up flips the auth state; the root layout's route
            // guard takes it from here.
        } catch (err) {
            setErrors({ form: getAuthErrorMessage(err) })
            setSubmitting(false)
        }
    }

    // A ScrollView: the form has a role-specific code field and a consent
    // line, and on a short screen with the keyboard up the Register button was
    // the thing that went off the bottom. Top-aligned and left-aligned like
    // the rest of the app, so an error never shoves the form around.
    return (
        <ThemedView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <ThemedText variant="title" tone="title" role="heading">
                    Create an account
                </ThemedText>

                <Spacer height={Space.xl} />

                <ThemedText variant="meta" tone="muted" style={styles.label}>
                    I am a
                </ThemedText>
                <SegmentedControl
                    label="I am a"
                    options={[
                        { value: 'client', label: 'Client' },
                        { value: 'trainer', label: 'Trainer' },
                    ]}
                    value={role}
                    onChange={(value) => {
                        setRole(value)
                        clear('code')
                    }}
                    disabled={submitting}
                />

                <Spacer height={Space.lg} />
                <ThemedText variant="meta" tone="muted" style={styles.label}>
                    Name
                </ThemedText>
                <ThemedTextInput
                    ref={nameRef}
                    accessibilityLabel="Name"
                    value={name}
                    onChangeText={(text) => {
                        setName(text)
                        clear('name')
                    }}
                    autoCapitalize="words"
                    autoComplete="name"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    invalid={Boolean(errors.name)}
                    editable={!submitting}
                />
                <FieldError>{errors.name}</FieldError>

                <Spacer height={Space.lg} />
                <ThemedText variant="meta" tone="muted" style={styles.label}>
                    Email
                </ThemedText>
                <ThemedTextInput
                    ref={emailRef}
                    accessibilityLabel="Email"
                    value={email}
                    onChangeText={(text) => {
                        setEmail(text)
                        clear('email')
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
                        clear('password')
                    }}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    onSubmitEditing={() => codeRef.current?.focus()}
                    invalid={Boolean(errors.password)}
                    editable={!submitting}
                />
                {errors.password ? (
                    <FieldError>{errors.password}</FieldError>
                ) : (
                    <ThemedText variant="small" tone="muted" style={styles.hint}>
                        At least {MIN_PASSWORD} characters.
                    </ThemedText>
                )}

                {/* Two codes, one box. A client's names one trainer and is
                    theirs to hand out; the trainer one is shared, rotated by us,
                    and is the only thing standing between a public signup page
                    and a stranger with a trainer account. */}
                <Spacer height={Space.lg} />
                <ThemedText variant="meta" tone="muted" style={styles.label}>
                    {role === 'client' ? 'Trainer invite code' : 'Trainer signup code'}
                </ThemedText>
                <ThemedTextInput
                    ref={codeRef}
                    accessibilityLabel={role === 'client' ? 'Trainer invite code' : 'Trainer signup code'}
                    value={role === 'client' ? inviteCode : trainerCode}
                    onChangeText={(text) => {
                        if (role === 'client') setInviteCode(text.toUpperCase())
                        else setTrainerCode(text)
                        clear('code')
                    }}
                    autoCapitalize={role === 'client' ? 'characters' : 'none'}
                    placeholder={role === 'client' ? 'From your trainer' : 'Ask us for this'}
                    returnKeyType="go"
                    onSubmitEditing={handleRegister}
                    invalid={Boolean(errors.code)}
                    editable={!submitting}
                />
                <FieldError>{errors.code}</FieldError>

                {/* Above the button, not below it. Consent has to be available
                    *before* the act it consents to, and these open as plain web
                    pages precisely so someone with no account yet can read them. */}
                <Spacer height={Space.xl} />
                <ThemedText variant="meta" tone="muted">
                    By registering you agree to our terms, and to how we handle your data — including the
                    training data your trainer records about you.
                </ThemedText>
                <Spacer height={Space.sm} />
                <LegalLinks />

                <FieldError>{errors.form}</FieldError>
                <Spacer height={Space.lg} />
                <ThemedButton onPress={handleRegister} disabled={submitting}>
                    <ThemedText variant="cardTitle" tone="onPrimary">
                        {submitting ? 'Creating account...' : 'Register'}
                    </ThemedText>
                </ThemedButton>

                <Spacer height={Space.md} />
                <Link href="/login" style={styles.link}>
                    <ThemedText variant="body" tone="accent">
                        Already have an account? Log in
                    </ThemedText>
                </Link>
            </ScrollView>
        </ThemedView>
    )
}

export default Register

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    container: {
        paddingHorizontal: Space.xl,
        paddingTop: 72,
        paddingBottom: Space.xl,
    },
    label: {
        marginBottom: Space.sm,
    },
    hint: {
        marginTop: Space.xs + 2,
    },
    link: {
        paddingVertical: Space.md,
    },
})
