import { useColorScheme } from 'react-native'
import BackPill from '../components/BackPill'
import { Colors } from '../constants/Colors'
import { FontFamily } from '../constants/Type'

/**
 * The one app bar every Stack in the app draws.
 *
 * The UI review counted four kinds of back button and three title styles:
 * React Navigation's default arrow and Plex title on most screens, a round
 * pill on the two that draw their own header, a text "Back" on exercise info.
 * Every Stack now takes its header from here, and every back control is
 * `BackPill`, so the app reads as one thing.
 *
 * `headerShadowVisible: false` also removes React Navigation's own bottom
 * border, which on the dark theme was a near-white hairline - the brightest
 * line on the screen.
 *
 * A screen with nothing beneath it gets no back arrow at all: the Library
 * root used to show one or not depending on how the Trainer arrived.
 */
export const useHeaderOptions = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return ({ navigation }) => ({
        headerStyle: { backgroundColor: theme.navBackground },
        headerTintColor: theme.title,
        headerShadowVisible: false,
        headerTitleAlign: 'left' as const,
        headerTitleStyle: { fontFamily: FontFamily.heading, fontSize: 20, color: theme.title },
        headerLeft: ({ canGoBack }) =>
            canGoBack ? <BackPill onPress={() => navigation.goBack()} label="Back" style={{ marginLeft: -8 }} /> : null,
    })
}
