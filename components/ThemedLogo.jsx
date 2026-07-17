import { Image, useColorScheme } from 'react-native'

// images
import DarkLogo from '../assets/img/gpLogo-black.png'
import LightLogo from '../assets/img/gpLogo-white.png'

const ThemedLogo = ({...props}) => {
    const colorScheme = useColorScheme()
    
    const logo = colorScheme === 'dark' ? LightLogo : DarkLogo

  return (
    <Image source={logo} {...props} />
  )
}
export default ThemedLogo