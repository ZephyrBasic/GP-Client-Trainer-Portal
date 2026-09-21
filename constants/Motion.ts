import { Easing, Platform } from 'react-native'

// react-native-web has no native animation driver and warns on every
// animation that asks for one; it runs the same animation in JS either way.
export const NATIVE_DRIVER = Platform.OS !== 'web'

// Signal's motion. Movement here answers something the person did - a sheet
// opening, a Set ticked, a row swiped away - and says what changed; nothing
// moves on its own to decorate a screen. The one exception is the loading
// placeholder's pulse, which is how a wait says it is still a wait.
//
// Short on purpose, like the spacing scale: a mid-workout tap wants its answer
// before the thumb has left the glass.
export const Duration = {
    // A value or a mark changing in place: a tick, a colour.
    quick: 140,
    // Content arriving where a placeholder was, a backdrop fading.
    base: 200,
    // Something entering from off-screen: a sheet.
    enter: 260,
}

// Decelerating in, accelerating out: arrivals settle, exits get out of the way.
export const Ease = {
    out: Easing.out(Easing.cubic),
    in: Easing.in(Easing.cubic),
}

// How long a read may take before its placeholder is drawn at all. Most
// answers land well inside this, and a placeholder that appears for a single
// frame is itself the flicker it exists to prevent.
export const PLACEHOLDER_DELAY_MS = 250
