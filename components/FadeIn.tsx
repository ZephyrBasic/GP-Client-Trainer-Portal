import { useEffect, useRef } from 'react'
import { Animated, type ViewProps } from 'react-native'

import { Duration, Ease, NATIVE_DRIVER } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Content that has just arrived, faded up over one short beat - the other
 * half of a Placeholder, so a loaded list settles in rather than snapping
 * over the shape that held its place. Plays once, on mount.
 */
const FadeIn = ({ style, ...props }: ViewProps) => {
    const reduced = useReducedMotion()
    const progress = useRef(new Animated.Value(0)).current

    useEffect(() => {
        if (reduced) {
            progress.setValue(1)
            return
        }
        Animated.timing(progress, {
            toValue: 1,
            duration: Duration.base,
            easing: Ease.out,
            useNativeDriver: NATIVE_DRIVER,
        }).start()
    }, [reduced, progress])

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] })

    return <Animated.View style={[{ opacity: progress, transform: [{ translateY }] }, style]} {...props} />
}

export default FadeIn
