import { StyleSheet } from 'react-native'
import { Link } from 'expo-router'

// themed components
import ThemedView from '../components/ThemedView'
import ThemedText from '../components/ThemedText'
import Spacer from '../components/Spacer'
import ThemedLogo from '../components/ThemedLogo'
import { useAuth } from '../contexts/AuthContext'


const HomeScreen = () => {
  const { user, profile, signOut } = useAuth()

  return (
    <ThemedView style={styles.container}>

      <ThemedLogo style={styles.img} />
      <Spacer height={20} />

      <ThemedText style={styles.title} title={true}>
        GreenPulse.fit
      </ThemedText>

      <Spacer height={10} />
      <ThemedText>Client Trainer Portal</ThemedText>
      <Spacer height={20}/>

      {user ? (
        <>
          <ThemedText>Signed in as {profile?.name ?? user.email} ({profile?.role ?? '...'})</ThemedText>
          <Spacer height={20} />
          <ThemedText onPress={signOut} style={styles.link}>Sign Out</ThemedText>
        </>
      ) : (
        <>
          <Link href="/login" style={styles.link}>
            <ThemedText>Login Page</ThemedText>
          </Link>
          <Link href="/register" style={styles.link}>
            <ThemedText>Register Page</ThemedText>
          </Link>
        </>
      )}
    </ThemedView>
  )
}

export default HomeScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  img: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
    link: {
    marginVertical: 10,
    borderBottomWidth: 1,
  }
})