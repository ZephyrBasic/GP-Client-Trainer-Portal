import type { TextProps } from 'react-native'

import ThemedText from './ThemedText'

/**
 * The uppercase micro-label that opens a group: FROM YOUR TRAINER, YOUR OWN,
 * THIS WEEK, WHAT CHANGED, SESSION LEFT OPEN.
 *
 * Its own component because five screens had grown five nearly-identical copies
 * of these four style rules, at three different sizes and two different greys.
 * A label is the quietest thing on a screen and the one most easily left
 * inconsistent, since nobody looks straight at it.
 *
 * Rides the `label` type token - Plex 600 at 10px, already tracked out and
 * uppercased - rather than its own sizing, so this component supplies only
 * the muted tone.
 *
 * Takes a colour through `style` for the one case that is not quiet - the amber
 * heading on a Session left open, which is the banner's whole point.
 */
const SectionLabel = ({ style, ...props }: TextProps) => (
    <ThemedText variant="label" tone="muted" style={style} {...props} />
)

export default SectionLabel
