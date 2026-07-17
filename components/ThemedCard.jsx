import { Stylesheet, useColorScheme, View } from 'react-native'
import { Colors } from '../constants/Colors'

const ThemedCard = ({ style, ...props }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

  return (
    <View 
    style={[{ backgroundColor: theme.uiBackground}, styles.card, style]}
    {...props}
    />
  )
}
export default ThemedCard

const styles = Stylesheet.create({
    card: {
        borderRadius: 5,
        padding: 20
    }
})
