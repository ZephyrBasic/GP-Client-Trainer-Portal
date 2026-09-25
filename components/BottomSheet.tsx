import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View, useColorScheme, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { Duration, Ease, NATIVE_DRIVER } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

type Props = {
    visible: boolean
    onClose: () => void
    children: ReactNode
    /** Extra sheet style - a height cap, say. The sheet's own chrome stays. */
    style?: ViewProps['style']
}

/**
 * The house bottom sheet: a plain RN Modal, still - three rows and a cancel
 * button don't earn a sheet library - but animated by hand rather than by
 * `animationType="slide"`.
 *
 * "slide" moves the whole Modal window, backdrop included, so the dimming
 * rose up the screen as a hard-edged dark slab behind the sheet, and closing
 * snapped it away with no exit at all. Here the two move as what they are:
 * the backdrop fades in place, the sheet rises from below it, and both run in
 * reverse on close before the Modal unmounts. Under reduced motion both simply
 * appear and disappear.
 */
const BottomSheet = ({ visible, onClose, children, style }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const insets = useSafeAreaInsets()
    const reduced = useReducedMotion()

    // Held past `visible` going false, so the exit has a Modal to play in.
    const [mounted, setMounted] = useState(visible)
    const [sheetHeight, setSheetHeight] = useState(() => Dimensions.get('window').height)
    const progress = useRef(new Animated.Value(0)).current

    // What was on the sheet as it began to close. Callers clear their state as
    // they close - the picker's open facet goes null, the delete form resets -
    // and rendering that live would empty the sheet halfway down the screen.
    const lastChildren = useRef(children)
    if (visible) lastChildren.current = children

    useEffect(() => {
        if (visible) {
            setMounted(true)
            return
        }
        if (reduced) {
            progress.setValue(0)
            setMounted(false)
            return
        }
        Animated.timing(progress, {
            toValue: 0,
            duration: Duration.base,
            easing: Ease.in,
            useNativeDriver: NATIVE_DRIVER,
        }).start(({ finished }) => {
            // Interrupted means it was reopened mid-exit; stay mounted.
            if (finished) setMounted(false)
        })
    }, [visible, reduced, progress])

    useEffect(() => {
        if (!mounted || !visible) return
        if (reduced) {
            progress.setValue(1)
            return
        }
        Animated.timing(progress, {
            toValue: 1,
            duration: Duration.enter,
            easing: Ease.out,
            useNativeDriver: NATIVE_DRIVER,
        }).start()
    }, [mounted, visible, reduced, progress])

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] })

    return (
        <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.fill}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
                    <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close" />
                </Animated.View>
                <View style={styles.anchor} pointerEvents="box-none">
                    <Animated.View
                        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
                        style={[
                            styles.sheet,
                            {
                                backgroundColor: theme.navBackground,
                                paddingBottom: insets.bottom + Space.lg,
                                transform: [{ translateY }],
                            },
                            style,
                        ]}
                    >
                        <View style={[styles.grabber, { backgroundColor: theme.line }]} />
                        {visible ? children : lastChildren.current}
                    </Animated.View>
                </View>
            </View>
        </Modal>
    )
}

export default BottomSheet

const styles = StyleSheet.create({
    fill: {
        flex: 1,
    },
    backdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    anchor: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: Radius.hero,
        borderTopRightRadius: Radius.hero,
        paddingTop: Space.sm,
        paddingHorizontal: Space.lg,
    },
    grabber: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: Radius.rail,
        marginBottom: Space.md,
    },
})
