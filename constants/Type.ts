import { useFonts } from 'expo-font'
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import {
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans'
import type { TextStyle } from 'react-native'

// Two families. Space Grotesk is loaded at 700 only - every heading and every
// performed number is that one weight - so `FontFamily.heading` names the
// weight along with the family rather than leaving a caller to also pick one.
// IBM Plex Sans carries the three weights everything else needs.
export const FontFamily = {
    heading: 'SpaceGrotesk_700Bold',
    body: 'IBMPlexSans_400Regular',
    bodyMedium: 'IBMPlexSans_500Medium',
    label: 'IBMPlexSans_600SemiBold',
}

/**
 * Loads Signal's two type families. Exported as a hook rather than a bare
 * `useFonts` call at the app root so the font list lives beside the tokens
 * that name them - adding a weight here and forgetting to load it would
 * otherwise fail silently, RN falling back to the system face per glyph.
 */
export const useSignalFonts = () =>
    useFonts({
        SpaceGrotesk_700Bold,
        IBMPlexSans_400Regular,
        IBMPlexSans_500Medium,
        IBMPlexSans_600SemiBold,
    })

// The repo's type scale - ten tokens, replacing what had been thirteen ad hoc
// `fontSize` values with no name at all. Letter-spacing in the design is
// specified in em; RN's `letterSpacing` is absolute points, so each value
// below is that em figure multiplied by the token's own fontSize.
//
// Only `metric` carries `fontVariant: ['tabular-nums']` here - it is the one
// token TOKENS.md calls out as tabular. Any other token used somewhere
// figures sit in a column (a heading, a date) takes tabular-nums at the call
// site instead, since that need is about the layout, not the token.
export const Type: Record<string, TextStyle> = {
    display: { fontFamily: FontFamily.heading, fontSize: 33, letterSpacing: -0.99 },
    title: { fontFamily: FontFamily.heading, fontSize: 26, letterSpacing: -0.52 },
    heading: { fontFamily: FontFamily.heading, fontSize: 24, letterSpacing: -0.72 },
    metric: { fontFamily: FontFamily.heading, fontSize: 21, fontVariant: ['tabular-nums'] },
    cardTitle: { fontFamily: FontFamily.heading, fontSize: 16, letterSpacing: -0.24 },
    body: { fontFamily: FontFamily.body, fontSize: 13 },
    meta: { fontFamily: FontFamily.body, fontSize: 12 },
    small: { fontFamily: FontFamily.body, fontSize: 11 },
    label: { fontFamily: FontFamily.label, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
    micro: { fontFamily: FontFamily.label, fontSize: 9, letterSpacing: 1.08, textTransform: 'uppercase' },
}
