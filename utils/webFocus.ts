import { Platform } from 'react-native'
import { Colors } from '../constants/Colors'

/**
 * The web's keyboard focus ring, in the accent.
 *
 * Browsers draw their own: a black rectangle, which on a pill-shaped control
 * drew a square inside the pill. `:focus-visible` only shows for keyboard
 * focus, never for a tap, and modern browsers bend an outline to follow the
 * element's own rounded corners. Inputs manage their own focus border
 * (components/ThemedTextInput), so they are left out here.
 *
 * Injected once at startup as a side effect of importing this module
 * (app/_layout.tsx); does nothing off the web.
 */
if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = `
        :focus-visible:not(input):not(textarea) { outline: 2px solid ${Colors.light.iconColorFocused}; outline-offset: 2px; }
        @media (prefers-color-scheme: dark) {
            :focus-visible:not(input):not(textarea) { outline-color: ${Colors.dark.iconColorFocused}; }
        }
    `
    document.head.appendChild(style)
}
