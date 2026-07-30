import { Stack } from 'expo-router'
// expo-status-bar, not react-native: `style="auto"` is expo's prop. React
// Native's own StatusBar spells it `barStyle` and silently ignored this.
import { StatusBar } from 'expo-status-bar'

export default function AuthLayout() {
    return (
        <>
            <StatusBar style="auto" />
            <Stack
               screenOptions={{ headerShown: false, animation: 'none' }} 
            />    
        </>
    )
}