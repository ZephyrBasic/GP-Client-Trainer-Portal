import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, StyleSheet, View, useColorScheme, type DimensionValue, type ViewProps } from 'react-native'

import ThemedCard from './ThemedCard'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { Duration, Ease, NATIVE_DRIVER, PLACEHOLDER_DELAY_MS } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * What a screen draws while a read is still out, in place of "Loading..." text.
 *
 * The text it replaces was the flicker: a sentence that appears, is read
 * halfway, and is swapped for the real content a moment later reads as a
 * message that vanished before it could be finished. A placeholder is
 * the shape of what is coming, so the swap reads as that shape filling in.
 *
 * Nothing is drawn for the first PLACEHOLDER_DELAY_MS - most reads answer
 * inside it, and then the content simply appears. Past it, the shape fades up
 * and breathes until the answer lands. Under reduced motion it holds still.
 *
 * Screen readers get one "Loading" rather than a run of empty bars.
 */
export const Placeholder = ({ children, style }: { children: ReactNode; style?: ViewProps['style'] }) => {
    const reduced = useReducedMotion()
    const [shown, setShown] = useState(false)
    const opacity = useRef(new Animated.Value(0)).current

    useEffect(() => {
        const timer = setTimeout(() => setShown(true), PLACEHOLDER_DELAY_MS)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (!shown) return
        if (reduced) {
            opacity.setValue(0.7)
            return
        }
        const pulse = Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: Duration.base, easing: Ease.out, useNativeDriver: NATIVE_DRIVER }),
            Animated.loop(
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 0.45, duration: 800, easing: Ease.out, useNativeDriver: NATIVE_DRIVER }),
                    Animated.timing(opacity, { toValue: 1, duration: 800, easing: Ease.out, useNativeDriver: NATIVE_DRIVER }),
                ])
            ),
        ])
        pulse.start()
        return () => pulse.stop()
    }, [shown, reduced, opacity])

    return (
        <Animated.View
            accessible={true}
            accessibilityLabel="Loading"
            accessibilityRole="progressbar"
            style={[{ opacity }, style]}
        >
            {children}
        </Animated.View>
    )
}

/** One bar of placeholder: roughly a line of text, in the hairline colour. */
export const PlaceholderBar = ({ width = '100%', height = 12 }: { width?: DimensionValue; height?: number }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    return <View style={[styles.bar, { width, height, backgroundColor: theme.line }]} />
}

/**
 * A list row still loading: a title and a meta line, on the same card the row
 * will be, so nothing shifts when it arrives. `count` draws several, for a list
 * whose length isn't known yet.
 */
export const PlaceholderRows = ({ count = 3, raised = false }: { count?: number; raised?: boolean }) => (
    <Placeholder style={styles.rows}>
        {Array.from({ length: count }, (_, i) => (
            <ThemedCard key={i} raised={raised} style={raised && styles.raised}>
                <PlaceholderBar width={i % 2 ? '45%' : '60%'} height={raised ? 22 : 14} />
                <View style={styles.gap} />
                <PlaceholderBar width={i % 2 ? '30%' : '38%'} height={10} />
            </ThemedCard>
        ))}
    </Placeholder>
)

/** An inline stretch of text still loading, for a label or a pill. */
export const PlaceholderInline = ({ width = 72 }: { width?: number }) => (
    <Placeholder style={styles.inline}>
        <PlaceholderBar width={width} height={10} />
    </Placeholder>
)

const styles = StyleSheet.create({
    bar: {
        borderRadius: Radius.rail * 2,
    },
    rows: {
        gap: Space.sm + 2,
    },
    raised: {
        paddingVertical: Space.xl,
    },
    gap: {
        height: Space.sm,
    },
    // A line of small text's height, so the pill or card holding this doesn't
    // change size when the words replace it.
    inline: {
        minHeight: 18,
        justifyContent: 'center',
    },
})
