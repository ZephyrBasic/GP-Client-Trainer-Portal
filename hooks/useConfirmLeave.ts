import { useEffect, useRef } from 'react'
import { Alert, Platform } from 'react-native'
import { useNavigation } from 'expo-router'
import type { NavigationProp, ParamListBase } from '@react-navigation/native'

/**
 * Asks before a half-filled form is thrown away.
 *
 * Backing out of Log a past session used to drop everything typed into it
 * without a word. This catches every way off the screen - the back button,
 * a swipe, Android's back key - through React Navigation's `beforeRemove`.
 * A save calls `allowLeave()` first, so leaving after saving never asks.
 *
 * `window.confirm` on the web because react-native-web's Alert does nothing.
 */
export const useConfirmLeave = (dirty: boolean, title: string, message: string) => {
    const navigation = useNavigation<NavigationProp<ParamListBase>>()
    const allowed = useRef(false)

    useEffect(
        () =>
            // Typed loosely: the Stack's event map isn't known here, and
            // beforeRemove is preventable on every Stack.
            navigation.addListener('beforeRemove', (e: any) => {
                if (!dirty || allowed.current) return
                e.preventDefault()
                const leave = () => navigation.dispatch(e.data.action)
                if (Platform.OS === 'web') {
                    if (window.confirm(`${title}\n\n${message}`)) leave()
                    return
                }
                Alert.alert(title, message, [
                    { text: 'Keep editing', style: 'cancel' },
                    { text: 'Discard', style: 'destructive', onPress: leave },
                ])
            }),
        [navigation, dirty, title, message]
    )

    return {
        allowLeave: () => {
            allowed.current = true
        },
    }
}
