import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ThemedText from './ThemedText'
import Pressable from './Touchable'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { Duration, Ease, NATIVE_DRIVER } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

type Message = { id: number; text: string; action?: { label: string; onPress: () => void } }

let listener: ((message: Message) => void) | null = null
let nextId = 1

/**
 * Says that something just happened - "Template saved" - after the screen
 * that did it has already navigated away.
 *
 * Saving a Template or a Client's targets used to land the Trainer back on a
 * list with no sign the save took. This is Material's snackbar: one short
 * line at the bottom, gone after a few seconds, with an optional action such
 * as Undo. Module-level so a save handler can call it on its way out without
 * the next screen having to know.
 */
export const showToast = (text: string, action?: Message['action']) => listener?.({ id: nextId++, text, action })

const VISIBLE_MS = 3500

/** Mounted once, at the root (app/_layout.tsx). */
const Toast = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const insets = useSafeAreaInsets()
    const reduced = useReducedMotion()
    const [message, setMessage] = useState<Message | null>(null)
    const opacity = useRef(new Animated.Value(0)).current

    useEffect(() => {
        listener = setMessage
        return () => {
            listener = null
        }
    }, [])

    useEffect(() => {
        if (!message) return
        opacity.setValue(reduced ? 1 : 0)
        if (!reduced) {
            Animated.timing(opacity, { toValue: 1, duration: Duration.base, easing: Ease.out, useNativeDriver: NATIVE_DRIVER }).start()
        }
        const timer = setTimeout(() => setMessage((current) => (current?.id === message.id ? null : current)), VISIBLE_MS)
        return () => clearTimeout(timer)
    }, [message, opacity, reduced])

    if (!message) return null

    return (
        <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 72 }]}>
            <Animated.View
                accessibilityLiveRegion="polite"
                role="status"
                style={[styles.toast, { backgroundColor: theme.title, opacity }]}
            >
                <ThemedText variant="body" style={[styles.text, { color: theme.background }]}>
                    {message.text}
                </ThemedText>
                {message.action ? (
                    <Pressable
                        onPress={() => {
                            message.action.onPress()
                            setMessage(null)
                        }}
                        stateColor={theme.background}
                        style={styles.action}
                    >
                        <ThemedText variant="body" style={[styles.actionText, { color: theme.background }]}>
                            {message.action.label}
                        </ThemedText>
                    </Pressable>
                ) : null}
            </Animated.View>
        </View>
    )
}

export default Toast

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: Space.lg,
        right: Space.lg,
        alignItems: 'center',
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
        minHeight: 48,
        maxWidth: 480,
        width: '100%',
        paddingLeft: Space.lg,
        paddingRight: Space.xs,
        borderRadius: Radius.button,
    },
    text: {
        flex: 1,
        paddingVertical: Space.md,
    },
    action: {
        minHeight: 44,
        paddingHorizontal: Space.md,
        borderRadius: Radius.pill,
        justifyContent: 'center',
    },
    actionText: {
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
})
