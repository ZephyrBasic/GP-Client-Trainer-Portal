import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, useColorScheme, View, type ViewProps } from 'react-native'
import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'

type Props = {
    visible: boolean
    onRetry?: () => void
    message?: string
    style?: ViewProps['style']
}

// Sits above a screen's normal content rather than replacing it. The screen
// underneath still renders - its usual empty state, or whatever was already
// loaded - so navigation keeps working and a dropped connection degrades into
// "this list might be incomplete" instead of a wall.
//
// It has to be honest about what it is: with no on-device cache (the JS SDK's
// persistence needs IndexedDB, which React Native doesn't have) there is no
// stale data to promise. So the copy says the list may be incomplete, not that
// we're showing a cached version.
const OfflineBanner = ({ visible, onRetry, message, style }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const [dismissed, setDismissed] = useState(false)

    // Re-arm on reconnect, so dismissing once doesn't suppress the warning for
    // the rest of the session - the next outage is new information.
    useEffect(() => {
        if (!visible) setDismissed(false)
    }, [visible])

    if (!visible || dismissed) return null

    return (
        <View
            style={[
                styles.banner,
                { backgroundColor: theme.uiBackground, borderLeftColor: Colors.warning },
                style,
            ]}
        >
            <View style={styles.body}>
                <ThemedText style={styles.message}>
                    {message ?? "Can't reach the server. What you see here may be out of date or incomplete."}
                </ThemedText>
                <View style={styles.actions}>
                    {onRetry && (
                        <Pressable onPress={onRetry} hitSlop={8}>
                            <ThemedText style={[styles.action, { color: Colors.primary }]}>Retry</ThemedText>
                        </Pressable>
                    )}
                    <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
                        <ThemedText style={styles.action}>Dismiss</ThemedText>
                    </Pressable>
                </View>
            </View>
        </View>
    )
}

export default OfflineBanner

const styles = StyleSheet.create({
    banner: {
        borderRadius: 5,
        borderLeftWidth: 4,
        padding: 12,
        marginBottom: 12,
    },
    body: {
        gap: 8,
    },
    message: {
        fontSize: 13,
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
    },
    action: {
        fontSize: 13,
        fontWeight: 'bold',
    },
})
