import { StyleSheet, useColorScheme, View, type ViewProps } from 'react-native'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'

/**
 * The surface almost everything sits on: a tinted panel, tight rather than airy.
 *
 * `muted` is for a row that exists but is not live - a Template nobody is
 * assigned to, a Client with no assignment, a workout that cannot be started.
 * Drawn flat, as a hairline on the screen's own background rather than a filled
 * panel, so it reads as present but inactive instead of being indistinguishable
 * from the rows around it.
 *
 * An outline rather than plain opacity, because opacity dims the text as well
 * and an inactive row still has to be readable. The border is always drawn -
 * transparent when the card is filled - so a muted row and a live one are the
 * same height and their contents line up across a list.
 *
 * `raised` is Signal's "the one thing you came to do" surface - a step
 * brighter than the ordinary card on dark, and the same white lifted with a
 * shadow on light, since light has no brighter surface than white to step to.
 * It also takes the wider hero radius rather than the row radius, since a
 * raised card is meant to read as a distinct object on the screen, not
 * another row in the list.
 */
const ThemedCard = ({
    style,
    muted = false,
    raised = false,
    ...props
}: ViewProps & { muted?: boolean; raised?: boolean }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <View
            style={[
                styles.card,
                muted
                    ? { backgroundColor: 'transparent', borderColor: theme.line }
                    : { backgroundColor: raised ? theme.raised : theme.uiBackground, borderColor: 'transparent' },
                raised && { borderRadius: Radius.hero },
                raised && colorScheme === 'light' && styles.raisedShadow,
                style,
            ]}
            {...props}
        />
    )
}
export default ThemedCard

const styles = StyleSheet.create({
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
        // Deliberately tight. A phone screen has to hold a banner, two section
        // labels and four rows without scrolling, and 20 points of padding on
        // every card spent that budget on air.
        padding: Space.md,
    },
    raisedShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
})
