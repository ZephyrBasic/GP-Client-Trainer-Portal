import { useState } from 'react'
import { StyleSheet } from 'react-native'
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
            <ThemedText title={true} style={styles.title}>
                Login to your account
            </ThemedText>

            <Spacer height={20} />

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

            {error ? (
                <>
                    <Spacer height={16} />
                    <ThemedText style={{ color: Colors.warning }}>{error}</ThemedText>
                </>
            ) : null}

            <Spacer height={20} />
            <ThemedButton onPress={handleLogin} disabled={submitting}>
                <ThemedText style={styles.btnText}>{submitting ? 'Logging in...' : 'Login'}</ThemedText>
            </ThemedButton>

            <Spacer height={20} />
            <Link href="/register" style={{ textAlign: 'center' }}>
                <ThemedText>Need an account? Register</ThemedText>
            </Link>
        </ThemedView>
    )
}

export default Login

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
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
