import { ActivityIndicator, StyleSheet, View } from 'react-native'

/**
 * The black 16:9 box every how-to player renders into.
 *
 * Shared because the YouTube player is platform-split (an <iframe> on web, the
 * native library on device) and both must sit in an identically sized box, or
 * the info screen's layout shifts depending on which one rendered.
 */
export const videoStyles = StyleSheet.create({
    frame: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    fill: {
        flex: 1,
        backgroundColor: '#000',
    },
    /** Overlays a player that is still loading. */
    spinner: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    /** Centres content *inside* the frame, for the unplayable-demo message. */
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
    },
})

/**
 * Covers a player's black frame until it has something to show.
 *
 * The player is a whole web page loading over the network, which on a phone on
 * gym wifi is a visible pause. Without this the client stares at a black
 * rectangle and cannot tell it apart from a broken video.
 */
export const Spinner = () => (
    <View style={videoStyles.spinner} pointerEvents="none">
        <ActivityIndicator color="#fff" />
    </View>
)
