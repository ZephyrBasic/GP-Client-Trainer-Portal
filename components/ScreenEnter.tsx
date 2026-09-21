import { useEffect, useRef } from 'react'
import { Animated, type ViewProps } from 'react-native'

import { Duration, Ease, NATIVE_DRIVER } from '../constants/Motion'
import { useReducedMotion } from '../hooks/useReducedMotion'

type Props = ViewProps & {
    /** False renders at rest - for a screen that only sometimes needs the entrance. */
    play?: boolean
}

/**
 * A whole screen rising into place, for the screens Today opens in another tab.
 *
 * Those arrive by switching tabs, which no navigator animates - and on web,
 * where the Stack has no transitions at all, that was a hard cut from one
 * screen to a different one. Bigger and slower than FadeIn, which is content
 * settling into a screen already there; this is the screen itself arriving.
 * The navigators switch their own push off for these routes, so it is never
 * one of two motions playing at once.
 *
 * Plays on mount, so wrap the loaded screen rather than its placeholder: what
 * rises in should be the thing the Client came for.
 */
const ScreenEnter = ({ play = true, style, ...props }: Props) => {
    const reduced = useReducedMotion()
    const progress = useRef(new Animated.Value(play ? 0 : 1)).current

    useEffect(() => {
        if (!play) return
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
    }, [play, reduced, progress])

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })

    return <Animated.View style={[{ flex: 1, opacity: progress, transform: [{ translateY }] }, style]} {...props} />
}

export default ScreenEnter
