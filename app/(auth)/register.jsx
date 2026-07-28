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
            <ThemedText title={true} style={styles.title}>
                Register for an account
            </ThemedText>

            <Spacer height={20} />

            <ThemedText style={styles.label}>Name</ThemedText>
            <ThemedTextInput value={name} onChangeText={setName} autoCapitalize="words" editable={!submitting} />

            <Spacer height={16} />
            <ThemedText style={styles.label}>Email</ThemedText>
            <ThemedTextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                editable={!submitting}
            />

            <Spacer height={16} />
            <ThemedText style={styles.label}>Password</ThemedText>
            <ThemedTextInput value={password} onChangeText={setPassword} secureTextEntry editable={!submitting} />

            <Spacer height={16} />
            <ThemedText style={styles.label}>I am a...</ThemedText>
            <Spacer height={8} />
            <ThemedView style={styles.roleRow}>
                <Pressable
                    style={[
                        styles.roleOption,
                        { borderColor: theme.iconColor },
                        role === 'client' && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                    ]}
                    onPress={() => setRole('client')}
                    disabled={submitting}
                >
                    <ThemedText style={role === 'client' && styles.roleTextSelected}>Client</ThemedText>
                </Pressable>
                <Pressable
                    style={[
                        styles.roleOption,
                        { borderColor: theme.iconColor },
                        role === 'trainer' && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                    ]}
                    onPress={() => setRole('trainer')}
                    disabled={submitting}
                >
                    <ThemedText style={role === 'trainer' && styles.roleTextSelected}>Trainer</ThemedText>
                </Pressable>
            </ThemedView>

            {role === 'client' && (
                <>
                    <Spacer height={16} />
                    <ThemedText style={styles.label}>Trainer invite code</ThemedText>
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
                    <Spacer height={16} />
                    <ThemedText style={{ color: Colors.warning }}>{error}</ThemedText>
                </>
            ) : null}

            <Spacer height={20} />
            <ThemedButton onPress={handleRegister} disabled={submitting}>
                <ThemedText style={styles.btnText}>{submitting ? 'Creating account...' : 'Register'}</ThemedText>
            </ThemedButton>

            <Spacer height={20} />
            <Link href="/login" style={{ textAlign: 'center' }}>
                <ThemedText>Already have an account? Login</ThemedText>
            </Link>
        </ThemedView>
    )
}

export default Register

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    title: {
        textAlign: 'center',
        fontSize: 18,
        marginBottom: 10,
    },
    label: {
        marginBottom: 6,
        fontSize: 14,
    },
    roleRow: {
        flexDirection: 'row',
        gap: 12,
    },
    roleOption: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 5,
        paddingVertical: 12,
        alignItems: 'center',
    },
    roleTextSelected: {
        color: '#fff',
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
