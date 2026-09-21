import { useRef, useState, type ReactNode } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, useColorScheme, type ViewProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { Duration, Ease, NATIVE_DRIVER } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

// How far a short swipe opens the row: the width of the Delete button behind it.
const REVEAL = 88
// A swipe released past this share of the row's width deletes without the
// second tap - the long, deliberate drag is its own confirmation.
const COMMIT_FRACTION = 0.5
// Horizontal travel before the gesture is claimed from whatever is under the
// finger. Below it a tap still reaches a text box or a checkbox.
const CLAIM_DISTANCE = 10

type Props = {
    children: ReactNode
    onDelete: () => void
    /** Off, the row is inert - an Exercise's last Set, or a save in flight. */
    enabled?: boolean
    /** Read by screen readers, which get the delete as an action instead of a gesture. */
    accessibilityLabel: string
    /**
     * The `gap` of the list this row sits in. Folding the row to nothing
     * still leaves its gap, which would then snap shut a frame later - so the
     * fold pulls that much back up as it goes.
     */
    collapseGap?: number
    style?: ViewProps['style']
}

/**
 * Swipe a row left to delete it - iOS's list gesture, built on PanResponder
 * and Animated rather than a gesture library, so it runs the same on native
 * and on web (where react-native-web drives the responder from the mouse too).
 *
 * A short swipe opens the row onto a Delete button; a long one deletes
 * outright. Either way the row slides out, then folds its height away so the
 * rows beneath close the gap instead of jumping into it. Tapping an open row
 * closes it again.
 *
 * The gesture is claimed only once it is clearly horizontal, and claimed in
 * the capture phase: a row is made of text boxes and a checkbox that would
 * otherwise keep the touch for themselves, while a vertical drag still
 * scrolls the screen underneath.
 *
 * Callers key their rows by index, so once `onDelete` runs this same instance
 * renders the row that moved up into the slot. Everything is reset in the
 * same breath as the delete, which is what makes that swap invisible.
 */
const SwipeToDelete = ({ children, onDelete, enabled = true, accessibilityLabel, collapseGap = 0, style }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const reduced = useReducedMotion()

    const translateX = useRef(new Animated.Value(0)).current
    // Height lives on its own outer view: it can't run on the native driver,
    // and one view can't mix drivers.
    const height = useRef(new Animated.Value(0)).current
    const [collapsing, setCollapsing] = useState(false)

    const width = useRef(0)
    const rowHeight = useRef(0)
    const offset = useRef(0)
    const busy = useRef(false)

    // The latest props, for the responder built once below.
    const latest = useRef({ enabled, onDelete, reduced })
    latest.current = { enabled, onDelete, reduced }

    const settle = (to: number) => {
        offset.current = to
        if (latest.current.reduced) {
            translateX.setValue(to)
            return
        }
        Animated.spring(translateX, {
            toValue: to,
            friction: 9,
            tension: 80,
            useNativeDriver: NATIVE_DRIVER,
        }).start()
    }

    const commit = () => {
        if (busy.current) return
        busy.current = true

        const finish = () => {
            latest.current.onDelete()
            translateX.setValue(0)
            offset.current = 0
            busy.current = false
            setCollapsing(false)
        }

        if (latest.current.reduced) {
            finish()
            return
        }

        height.setValue(rowHeight.current)
        setCollapsing(true)
        Animated.timing(translateX, {
            toValue: -(width.current || REVEAL * 4),
            duration: Duration.base,
            easing: Ease.in,
            useNativeDriver: NATIVE_DRIVER,
        }).start(() => {
            Animated.timing(height, {
                toValue: 0,
                duration: Duration.base,
                easing: Ease.out,
                useNativeDriver: false,
            }).start(finish)
        })
    }

    const responder = useRef(
        PanResponder.create({
            // An open row takes the next touch, whatever it lands on, to close.
            onStartShouldSetPanResponderCapture: () => offset.current !== 0 && !busy.current,
            onMoveShouldSetPanResponderCapture: (_, g) => {
                if (!latest.current.enabled || busy.current) return false
                const horizontal = Math.abs(g.dx) > CLAIM_DISTANCE && Math.abs(g.dx) > Math.abs(g.dy) * 1.5
                return horizontal && (g.dx < 0 || offset.current !== 0)
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderMove: (_, g) => {
                const next = Math.min(0, Math.max(-(width.current || Infinity), offset.current + g.dx))
                translateX.setValue(next)
            },
            onPanResponderRelease: (_, g) => {
                const x = offset.current + g.dx
                const tapped = Math.abs(g.dx) < CLAIM_DISTANCE && Math.abs(g.dy) < CLAIM_DISTANCE
                if (tapped) return settle(0)
                const far = width.current > 0 && x < -width.current * COMMIT_FRACTION
                const flung = g.vx < -1.2 && x < -REVEAL
                if (far || flung) return commit()
                settle(x < -REVEAL / 2 ? -REVEAL : 0)
            },
            onPanResponderTerminate: () => settle(offset.current),
        })
    ).current

    // The red layer is only drawn once the row has moved, so a row at rest
    // has nothing behind it to show at its corners.
    const behindOpacity = translateX.interpolate({
        inputRange: [-12, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    })

    return (
        <Animated.View
            style={[
                collapsing && {
                    height,
                    overflow: 'hidden',
                    opacity: height.interpolate({ inputRange: [0, rowHeight.current || 1], outputRange: [0, 1] }),
                    marginBottom: height.interpolate({
                        inputRange: [0, rowHeight.current || 1],
                        outputRange: [-collapseGap, 0],
                    }),
                },
                style,
            ]}
            onLayout={(e) => {
                if (!collapsing) rowHeight.current = e.nativeEvent.layout.height
                width.current = e.nativeEvent.layout.width
            }}
            accessibilityActions={enabled ? [{ name: 'delete', label: 'Delete' }] : undefined}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && commit()}
            accessibilityLabel={accessibilityLabel}
        >
            {enabled ? (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        styles.behind,
                        { backgroundColor: theme.danger, opacity: behindOpacity },
                    ]}
                >
                    <Pressable
                        onPress={commit}
                        style={styles.deleteButton}
                        accessibilityRole="button"
                        accessibilityLabel="Delete"
                    >
                        <Ionicons name="trash-outline" size={14} color={theme.background} />
                        <ThemedText variant="small" style={{ color: theme.background }}>
                            Delete
                        </ThemedText>
                    </Pressable>
                </Animated.View>
            ) : null}
            <Animated.View style={{ transform: [{ translateX }] }} {...(enabled ? responder.panHandlers : null)}>
                {children}
            </Animated.View>
        </Animated.View>
    )
}

export default SwipeToDelete

const styles = StyleSheet.create({
    behind: {
        borderRadius: Radius.card,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    // Icon beside the word rather than above it: an authoring row is barely
    // taller than its text box, and a stacked pair would be clipped.
    deleteButton: {
        width: REVEAL,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.xs,
    },
})
