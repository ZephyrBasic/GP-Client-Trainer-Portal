import { useState } from 'react'
import { ScrollView, StyleSheet, useColorScheme } from 'react-native'
import Pressable from '../../components/Touchable'
import { Link } from 'expo-router'

// themed components
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedTextInput from '../../components/ThemedTextInput'
import ThemedButton from '../../components/ThemedButton'
import LegalLinks from '../../components/LegalLinks'
import Spacer from '../../components/Spacer'

import { Colors } from '../../constants/Colors'
import { Radius, Space } from '../../constants/Layout'
import { useAuth } from '../../contexts/AuthContext'
import { getAuthErrorMessage } from '../../utils/firebaseErrors'

const Register = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { signUp } = useAuth()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState('client')
    const [inviteCode, setInviteCode] = useState('')
    const [trainerCode, setTrainerCode] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleRegister = async () => {
        setError('')

        if (!name.trim() || !email.trim() || !password) {
            setError('Please fill in your name, email, and password.')
            return
        }
        if (role === 'client' && !inviteCode.trim()) {
            setError("Please enter your trainer's invite code.")
            return
        }
        // Only that it is present. Whether it is *right* is a question only
        // firestore.rules can answer, because the code is deliberately not
        // readable by this app - see AuthContext.signUp.
        if (role === 'trainer' && !trainerCode.trim()) {
            setError('Please enter the trainer signup code.')
            return
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
            setError(getAuthErrorMessage(err))
            setSubmitting(false)
        }
    }

    // A ScrollView now rather than a centred block: the form grew a role-specific
    // code field and a consent line, and on a short screen with the keyboard up
    // the Register button was the thing that went off the bottom.
    return (
        <ThemedView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Spacer />
            <ThemedText variant="title" tone="title" style={styles.title}>
                Register for an account
            </ThemedText>

            <Spacer height={Space.xl} />

            <ThemedText variant="label" tone="muted" style={styles.label}>
                Name
            </ThemedText>
            <ThemedTextInput value={name} onChangeText={setName} autoCapitalize="words" editable={!submitting} />

            <Spacer height={Space.lg} />
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

            <Spacer height={Space.lg} />
            <ThemedText variant="label" tone="muted" style={styles.label}>
                I am a...
            </ThemedText>
            <Spacer height={Space.sm} />
            <ThemedView style={styles.roleRow}>
                <Pressable
                    style={[
                        styles.roleOption,
                        { borderColor: theme.line },
                        role === 'client' && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setRole('client')}
                    disabled={submitting}
                >
                    <ThemedText
                        variant="body"
                        tone={role === 'client' ? 'onPrimary' : 'body'}
                    >
                        Client
                    </ThemedText>
                </Pressable>
                <Pressable
                    style={[
                        styles.roleOption,
                        { borderColor: theme.line },
                        role === 'trainer' && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setRole('trainer')}
                    disabled={submitting}
                >
                    <ThemedText
                        variant="body"
                        tone={role === 'trainer' ? 'onPrimary' : 'body'}
                    >
                        Trainer
                    </ThemedText>
                </Pressable>
            </ThemedView>

            {role === 'client' && (
                <>
                    <Spacer height={Space.lg} />
                    <ThemedText variant="label" tone="muted" style={styles.label}>
                        Trainer invite code
                    </ThemedText>
                    <ThemedTextInput
                        value={inviteCode}
                        onChangeText={(text) => setInviteCode(text.toUpperCase())}
                        autoCapitalize="characters"
                        placeholder="e.g. AB12CD"
                        editable={!submitting}
                    />
                </>
            )}

            {/* The trainer side of the same gate. A client's code names one
                trainer and is theirs to hand out; this one is shared, rotated
                by us, and is the only thing standing between a public signup
                page and a stranger with a trainer account. */}
            {role === 'trainer' && (
                <>
                    <Spacer height={Space.lg} />
                    <ThemedText variant="label" tone="muted" style={styles.label}>
                        Trainer signup code
                    </ThemedText>
                    <ThemedTextInput
                        value={trainerCode}
                        onChangeText={setTrainerCode}
                        autoCapitalize="none"
                        placeholder="Ask us for this"
                        editable={!submitting}
                    />
                </>
            )}

            {error ? (
                <>
                    <Spacer height={Space.lg} />
                    <ThemedText variant="body" tone="danger">
                        {error}
                    </ThemedText>
                </>
            ) : null}

            {/* Above the button, not below it. Consent has to be available
                *before* the act it consents to, and these open as plain web
                pages precisely so someone with no account yet can read them. */}
            <Spacer height={Space.xl} />
            <ThemedText variant="meta" tone="muted" style={styles.consent}>
                By registering you agree to our terms, and to how we handle your data - including the
                training data your trainer records about you.
            </ThemedText>
            <Spacer height={Space.sm} />
            <LegalLinks />

            <Spacer height={Space.lg} />
            <ThemedButton onPress={handleRegister} disabled={submitting}>
                <ThemedText variant="cardTitle" tone="onPrimary">
                    {submitting ? 'Creating account...' : 'Register'}
                </ThemedText>
            </ThemedButton>

            <Spacer height={Space.xl} />
            <Link href="/login" style={styles.link}>
                <ThemedText variant="body" tone="accent">
                    Already have an account? Login
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
        // flexGrow rather than flex, so the form still centres on a tall screen
        // and scrolls on a short one instead of being squashed.
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: Space.xl,
        paddingBottom: Space.xl,
    },
    title: {
        textAlign: 'center',
        marginBottom: Space.sm,
    },
    consent: {
        textAlign: 'center',
    },
    label: {
        marginBottom: Space.sm,
    },
    roleRow: {
        flexDirection: 'row',
        gap: Space.md,
    },
    roleOption: {
        flex: 1,
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingVertical: Space.md,
        alignItems: 'center',
    },
    link: {
        textAlign: 'center',
    },
})
