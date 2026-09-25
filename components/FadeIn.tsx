import { useEffect, useRef } from 'react'
import { Animated, type ViewProps } from 'react-native'

import { Duration, Ease, NATIVE_DRIVER } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Content that has just arrived, faded up over one short beat - the other
 * half of a Placeholder, so a loaded list settles in rather than snapping
 * over the shape that held its place. Plays once, on mount.
 *
 * `delay` staggers a set of these against each other (constants/Motion), for a
 * screen whose rows should land in reading order rather than in one block. The
 * element is invisible until its turn comes, so a delay is a real wait - keep
 * it to the couple of hundred milliseconds STAGGER_MAX_MS allows.
 *
 * `rise` is how far it travels on the way in. The default is the nudge a row
 * settling into a list wants; a screen's own header or footer arriving takes a
 * little more, since it has further to have come from.
 */
const FadeIn = ({ delay = 0, rise = 4, style, ...props }: ViewProps & { delay?: number; rise?: number }) => {
    const reduced = useReducedMotion()
    const progress = useRef(new Animated.Value(0)).current

    useEffect(() => {
        if (reduced) {
            progress.setValue(1)
            return
        }
        Animated.timing(progress, {
            toValue: 1,
            delay,
            duration: Duration.base,
            easing: Ease.out,
            useNativeDriver: NATIVE_DRIVER,
        }).start()
    }, [delay, reduced, progress])

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] })

    return <Animated.View style={[{ opacity: progress, transform: [{ translateY }] }, style]} {...props} />
}

export default FadeIn
