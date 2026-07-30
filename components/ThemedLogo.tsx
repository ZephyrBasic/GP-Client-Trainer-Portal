import { Image, useColorScheme, type ImageProps } from 'react-native'

// images
import DarkLogo from '../assets/img/gpLogo-black.png'
import LightLogo from '../assets/img/gpLogo-white.png'

// `source` is chosen from the color scheme, so callers must not supply it.
const ThemedLogo = ({...props}: Omit<ImageProps, 'source'>) => {
    const colorScheme = useColorScheme()
    
    const logo = colorScheme === 'dark' ? LightLogo : DarkLogo

  return (
    <Image source={logo} {...props} />
  )
}
export default ThemedLogo