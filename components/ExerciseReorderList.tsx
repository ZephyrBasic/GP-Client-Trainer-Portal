import { useLayoutEffect, useRef, useState } from 'react'
import {
    Animated,
    PanResponder,
    Platform,
    StyleSheet,
    View,
    useColorScheme,
    type PanResponderInstance,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { Duration, Ease, NATIVE_DRIVER } from '../constants/Motion'
import { FontFamily } from '../constants/Type'
import { useReducedMotion } from '../hooks/useReducedMotion'

// Every row is the same height, so a drag's distance converts straight into a
// slot without measuring anything - which is the reason this list exists
// rather than dragging the full Set editors, whose heights vary with their Sets.
const ROW_HEIGHT = 56
const GAP = Space.sm
const SLOT = ROW_HEIGHT + GAP
const HANDLE_WIDTH = 48

// Pointer-only styles react-native-web understands and native ignores. Without
// `touchAction: none` a phone browser scrolls the page under the handle
// instead of handing the drag to the responder.
const HANDLE_WEB = Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'grab', userSelect: 'none' } as any) : null

export type ReorderItem = {
    name: string
    /** One quiet line beside the name, e.g. "3 sets". */
    detail?: string
}

type Props = {
    items: ReorderItem[]
    onMove: (from: number, to: number) => void
    /**
     * True for as long as a row is held. The screen turns its ScrollView's
     * scrolling off meanwhile: on Android a ScrollView takes a vertical drag
     * from its child whatever the child asks, and the row would be dropped.
     */
    onDragChange?: (dragging: boolean) => void
}

/**
 * The Exercises of a Template or a Session as one compact row each, dragged by
 * the grip at the right into a new order.
 *
 * Built on PanResponder and Animated, like SwipeToDelete, so it runs the same
 * on native and on web without a gesture library. Only the grip starts a drag;
 * the rest of the row still scrolls the screen.
 *
 * The held row follows the finger and the rows it passes slide a slot the
 * other way. The order itself changes once, on release - nothing is written
 * per slot crossed - and the dropped row then settles the last few pixels
 * into its slot.
 *
 * Rows are keyed by index, so once `onMove` runs each row renders the item
 * that is now in its slot. Every offset is cleared in the layout effect of
 * that same render, before it is painted, which is what makes the swap
 * invisible.
 *
 * Screen readers get "Move up" and "Move down" as actions on each row instead
 * of the gesture.
 */
const ExerciseReorderList = ({ items, onMove, onDragChange }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const reduced = useReducedMotion()

    const [active, setActive] = useState<number | null>(null)
    const drag = useRef(new Animated.Value(0)).current
    const offsets = useRef<Animated.Value[]>([]).current
    while (offsets.length < items.length) offsets.push(new Animated.Value(0))

    // Mutable drag state, read by responders that are created once per row.
    const from = useRef(0)
    const to = useRef(0)
    const dy = useRef(0)
    // Set when a drop has been handed to `onMove`: how far the dropped row
    // still is from its new slot, to be settled once the new order renders.
    const settle = useRef<{ index: number; residual: number } | null>(null)

    // Read through a ref so the responders, made once, always see this render.
    const latest = useRef({ items, onMove, onDragChange, reduced })
    latest.current = { items, onMove, onDragChange, reduced }

    const animate = (value: Animated.Value, toValue: number) => {
        if (latest.current.reduced) return value.setValue(toValue)
        Animated.timing(value, {
            toValue,
            duration: Duration.quick,
            easing: Ease.out,
            useNativeDriver: NATIVE_DRIVER,
        }).start()
    }

    const start = (index: number) => {
        from.current = index
        to.current = index
        dy.current = 0
        drag.setValue(0)
        setActive(index)
        latest.current.onDragChange?.(true)
    }

    const move = (rawDy: number) => {
        const count = latest.current.items.length
        const i = from.current
        // Held to the list: a row dragged past either end stays at that end.
        const clamped = Math.max(-i * SLOT, Math.min((count - 1 - i) * SLOT, rawDy))
        dy.current = clamped
        drag.setValue(clamped)

        const next = Math.max(0, Math.min(count - 1, Math.round(i + clamped / SLOT)))
        if (next === to.current) return
        to.current = next
        offsets.forEach((offset, j) => {
            if (j === i || j >= count) return
            const shift = j > i && j <= next ? -SLOT : j < i && j >= next ? SLOT : 0
            animate(offset, shift)
        })
    }

    const end = () => {
        const i = from.current
        const target = to.current
        settle.current = { index: target, residual: dy.current - (target - i) * SLOT }
        setActive(null)
        latest.current.onDragChange?.(false)
        if (target !== i) latest.current.onMove(i, target)
        else clearOffsets()
    }

    const clearOffsets = () => {
        const pending = settle.current
        settle.current = null
        drag.setValue(0)
        offsets.forEach((offset) => {
            offset.stopAnimation()
            offset.setValue(0)
        })
        if (pending && pending.residual !== 0 && offsets[pending.index]) {
            offsets[pending.index].setValue(pending.residual)
            animate(offsets[pending.index], 0)
        }
    }

    // A moved order arrives as new `items`; clear the offsets before it paints.
    useLayoutEffect(() => {
        if (settle.current) clearOffsets()
    }, [items])

    const responders = useRef<PanResponderInstance[]>([]).current
    const responderFor = (index: number) => {
        responders[index] ??= PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onPanResponderGrant: () => start(index),
            onPanResponderMove: (_, g) => move(g.dy),
            onPanResponderRelease: end,
            // Losing the gesture drops the row where it is, as a release would.
            onPanResponderTerminate: end,
            onPanResponderTerminationRequest: () => false,
        })
        return responders[index]
    }

    const moveBy = (index: number, delta: number) => {
        const target = index + delta
        if (target >= 0 && target < items.length) onMove(index, target)
    }

    return (
        <View style={[styles.list, { height: items.length * SLOT - GAP }]}>
            {items.map((item, index) => {
                const held = active === index
                return (
                    <Animated.View
                        key={index}
                        accessible
                        accessibilityLabel={`${index + 1}. ${item.name}${item.detail ? `, ${item.detail}` : ''}`}
                        accessibilityActions={[
                            ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
                            ...(index < items.length - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
                        ]}
                        onAccessibilityAction={(e) => moveBy(index, e.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
                        style={[
                            styles.row,
                            {
                                top: index * SLOT,
                                backgroundColor: held ? theme.raised : theme.uiBackground,
                                borderColor: held ? theme.outline : theme.line,
                                transform: [{ translateY: held ? drag : offsets[index] }],
                            },
                            held && styles.held,
                        ]}
                    >
                        <ThemedText variant="small" tone="muted" style={styles.position}>
                            {index + 1}
                        </ThemedText>
                        <View style={styles.text}>
                            <ThemedText variant="body" tone="title" numberOfLines={1}>
                                {item.name}
                            </ThemedText>
                            {item.detail ? (
                                <ThemedText variant="small" tone="muted" numberOfLines={1}>
                                    {item.detail}
                                </ThemedText>
                            ) : null}
                        </View>
                        <View
                            style={[styles.handle, HANDLE_WEB]}
                            {...responderFor(index).panHandlers}
                            importantForAccessibility="no-hide-descendants"
                        >
                            <Ionicons name="reorder-three" size={24} color={held ? theme.title : theme.iconColor} />
                        </View>
                    </Animated.View>
                )
            })}
        </View>
    )
}

export default ExerciseReorderList

const styles = StyleSheet.create({
    // Rows are placed absolutely in fixed slots rather than stacked, so a
    // held row can be lifted above its neighbours without reflowing them.
    list: {
        position: 'relative',
    },
    row: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: ROW_HEIGHT,
        borderWidth: 1,
        borderRadius: Radius.card,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: Space.md,
        gap: Space.sm,
    },
    held: {
        zIndex: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 6,
    },
    position: {
        width: Space.xl,
        fontFamily: FontFamily.heading,
        fontVariant: ['tabular-nums'],
    },
    text: {
        flex: 1,
        minWidth: 0,
    },
    handle: {
        width: HANDLE_WIDTH,
        height: ROW_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
})

/** One row per Exercise draft, with its Set count as the detail line. */
export const reorderItemsFrom = (exercises: { name: string; sets: unknown[] }[]): ReorderItem[] =>
    exercises.map((ex) => ({ name: ex.name, detail: `${ex.sets.length} ${ex.sets.length === 1 ? 'set' : 'sets'}` }))
