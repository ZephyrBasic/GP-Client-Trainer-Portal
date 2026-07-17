import { StyleSheet } from 'react-native'
import { Link } from 'expo-router'

// themed components
import ThemedView from '../../components/ThemedView'
import ThemedText from '../../components/ThemedText'
import Spacer from '../../components/Spacer'

const Register = () => {
    return (
      <ThemedView style={styles.container}>
        <Spacer />
        <ThemedText title={true} style={styles.title}>
            Register for an account
        </ThemedText>

        <Spacer height={20} />
        <Link href="/login" style={{ textAlign: 'center' }}>
            <ThemedText>Login</ThemedText>
        </Link>

      </ThemedView>
    )
}

export default Register

const styles = StyleSheet.create({
    container: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 30,
  }
})
