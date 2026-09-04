// Signal's geometry - see .claude/docs/design/TOKENS.md for the reasoning
// behind each number. Both scales are short on purpose: a screen reaching for
// a value outside them is a screen that should reach for the nearest token
// instead, not a sign the scale needs a new entry.

// Radii. `pill` covers chips, badges, checkboxes, secondary buttons, the back
// button and the search field - everything that isn't the one raised card or
// the one filled button on a screen.
export const Radius = {
    pill: 999,
    hero: 14,
    button: 12,
    card: 10,
    // The accent left edge on a ticked or departed-from-target set row, not a
    // corner radius in the usual sense.
    rail: 2,
}

// Spacing scale: 4 / 8 / 12 / 16 / 20 / 24. The artboards contain some
// off-scale values (7, 9, 11, 13, 18) from freehand layout - snap those to
// this scale when porting a mockup, nothing depends on the odd numbers.
export const Space = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
}

// Horizontal padding every screen body uses, so edges line up across routes
// without each screen re-deciding it.
export const SCREEN_PADDING = 20
