import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

// The OS "reduce motion" setting, live. react-native-web answers this from the
// prefers-reduced-motion media query, so one hook covers every platform.
// Anything that animates checks this and jumps straight to its end state.
export const useReducedMotion = () => {
    const [reduced, setReduced] = useState(false)

    useEffect(() => {
        let mounted = true
        AccessibilityInfo.isReduceMotionEnabled()
            .then((value) => mounted && setReduced(value))
            .catch(() => {})
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
        return () => {
            mounted = false
            subscription?.remove?.()
        }
    }, [])

    return reduced
}
