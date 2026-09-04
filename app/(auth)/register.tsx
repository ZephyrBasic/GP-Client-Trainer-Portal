import { useState } from 'react'
import { Pressable, StyleSheet, useColorScheme } from 'react-native'
import { Link } from 'expo-router'

// themed components
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import ThemedTextInput from '../../components/ThemedTextInput'
import ThemedButton from '../../components/ThemedButton'
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

        setSubmitting(true)
        try {
            await signUp(email.trim(), password, { name: name.trim(), role, inviteCode: inviteCode.trim() })
            // Successful sign-up flips the auth state; the root layout's route
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

            {error ? (
                <>
                    <Spacer height={Space.lg} />
                    <ThemedText variant="body" tone="danger">
                        {error}
                    </ThemedText>
                </>
            ) : null}

            <Spacer height={Space.xl} />
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
        </ThemedView>
    )
}

export default Register

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
