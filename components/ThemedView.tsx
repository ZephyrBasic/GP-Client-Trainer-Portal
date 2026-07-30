import { View, useColorScheme, type ViewProps } from 'react-native'
import { Colors } from '../constants/Colors'

const ThemedView = ({ style, ...props }: ViewProps) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
  return (
    <View 
    style={[{ backgroundColor: theme.background}, style]}
    {...props}
    />
  )
}
export default ThemedView
