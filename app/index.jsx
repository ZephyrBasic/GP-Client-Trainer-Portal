import { StyleSheet, Text, useColorScheme } from 'react-native'
import { Link } from 'expo-router'

import Logo from '../assets/img/gpLogo-black.png'

// themed components
import ThemedView from '../components/ThemedView'
import ThemedText from '../components/ThemedText'
import Spacer from '../components/Spacer'
import ThemedLogo from '../components/ThemedLogo'


const HomeScreen = () => {
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

      <Link href="/login" style={styles.link}>
        <ThemedText>Login Page</ThemedText>
      </Link>
      <Link href="/register" style={styles.link}>
        <ThemedText>Register Page</ThemedText>
      </Link>
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