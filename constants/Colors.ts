// GreenPulse brand palette - "Signal", settled 2026-08-29/30 and documented in
// full at .claude/docs/design/TOKENS.md, which is the source of truth for
// every value below. Derived in OKLCH at hue 155 so light and dark are the
// same design at a different lightness, not two different palettes. Every
// text/surface pairing clears WCAG AA - don't round these to "nicer" hex
// values, they were chosen numerically.
//
// `primary` is per-theme, unlike the palette this replaced: Signal fills its
// primary button with the accent, which needs dark ink on the dark theme's
// bright green and white ink on the light theme's darker one, so one
// cross-theme value can no longer carry it. `onPrimary` is that ink, handed
// out alongside it for exactly that reason - it is the colour a button's own
// label should take, not a colour for anything else.
//
// `iconColorFocused` is the **accent**, and does more than its name says: it
// is the colour of a link, a chip, a ticked checkbox, the running clock and a
// progress bar's fill. Reach for this rather than `primary` for anything that
// is not a filled button - `primary` exists to name what sits *under* button
// ink, nothing more.
export const Colors = {
    dark: {
        background: '#080B09',
        navBackground: '#10150F',
        uiBackground: '#1E2320',
        // The one thing you came to do, a further step brighter than
        // uiBackground. uiBackground on background used to be a 1.08:1 step -
        // perceptually invisible. It is now 1.24:1, and raised is 1.51:1: that
        // two-level ladder is the whole reason the hero card reads.
        raised: '#2C322E',
        // The hairline: card outlines, dividers, the rule under a header, the
        // border on an inset input. A step *away* from `background` rather
        // than toward it, so a border reads on the page and on a card alike -
        // `uiBackground` cannot do this job because a card is painted in it.
        line: '#363C38',
        // The hairline *inside* a card - a divider between rows that already
        // sit on uiBackground, so it has to take a smaller step than `line`
        // takes off the page background, or the row dividers would read
        // louder than the card's own edge.
        lineSoft: '#282D29',
        // The edge of a *control* - an input, an outlined button, a chip -
        // where `line` is the edge of a surface. Controls need 3:1 against
        // what they sit on (WCAG 1.4.11); `line` sits near 1.4:1 by design,
        // which left every input and ghost button a faint shape.
        outline: '#727B75',
        title: '#ECF4EE',
        text: '#B3BEB6',
        iconColor: '#828C85',
        // Quieter again than iconColor: column heads and set numbers, which
        // have to sit under body text without competing with it. Raised in
        // the UI review from ~2.5:1 to ~3.7:1 - it was unreadable - and still
        // never for data a Client needs to read; use `text` for that.
        faint: '#737C76',
        iconColorFocused: '#51B67A',
        // oklch(0.70 0.130 155). The old accent was #3DDC84 = oklch(0.79 0.180
        // 154) - near the sRGB ceiling for its lightness, and carrying half
        // again the chroma of the amber beside it. This sits level with the
        // amber's 0.122. Don't brighten it back.
        primary: '#51B67A',
        onPrimary: '#080B09',
        // "Worth a look", between `primary`'s "fine" and `danger`'s "wrong".
        //
        // Modified is deliberately not `danger`. The verdict is strict - one
        // rep short is Modified (ADR 0005) - so most Sessions will be, and
        // drawing that in red would tell every Client who dropped a rep that
        // they had failed. A neutral grey has the opposite problem: it reads
        // as "no state at all", which is what a Session with no verdict gets.
        amber: '#EAB85E',
        // Red on a dark ground, lightened until it reads as text - too light
        // to fill a button with, which is a decision for whatever draws one.
        danger: '#EB817F',

        // Chips and banners are tinted rather than filled: a solid amber
        // would need dark text on the dark theme's light amber and white text
        // on the light theme's dark amber, a contrast flip in the middle of a
        // palette that has none. A wash of the colour at low alpha behind the
        // colour itself holds in both themes and stays quiet enough to sit
        // four to a screen. Written as rgba here because React Native has no
        // colour mixing - these are the only place the palette is arithmetic.
        accentTint: 'rgba(81, 182, 122, 0.14)',
        amberTint: 'rgba(234, 184, 94, 0.13)',
        mutedTint: 'rgba(130, 140, 133, 0.16)',
        dangerTint: 'rgba(235, 129, 127, 0.16)',
    },
    light: {
        background: '#E8EFEA',
        navBackground: '#F3F8F5',
        uiBackground: '#FFFFFF',
        // White again, the same as uiBackground: the light theme raises a
        // card with a shadow rather than a further step of tint (see
        // ThemedCard) - there is no lighter surface than white to step to.
        raised: '#FFFFFF',
        // Darker than `uiBackground` where the dark theme's is lighter than
        // its own - the same idea, mirrored: a hairline has to be a step away
        // from the surface, and which way that is depends on which way the
        // theme goes.
        line: '#CFDAD3',
        lineSoft: '#E0E9E3',
        outline: '#7A857D',
        title: '#19251D',
        text: '#4D5950',
        iconColor: '#68736B',
        faint: '#78837B',
        iconColorFocused: '#1E7546',
        primary: '#1E7546',
        onPrimary: '#FFFFFF',
        // Far darker than the dark theme's amber, for the same reason the
        // accent is: the dark theme's amber is barely visible on a near-white
        // background.
        amber: '#9C640D',
        danger: '#BA3535',

        accentTint: 'rgba(30, 117, 70, 0.10)',
        amberTint: 'rgba(156, 100, 13, 0.10)',
        mutedTint: 'rgba(104, 115, 107, 0.14)',
        dangerTint: 'rgba(186, 53, 53, 0.12)',
    }
}
