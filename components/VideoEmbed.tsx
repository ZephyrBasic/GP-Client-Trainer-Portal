import { createElement } from 'react'
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'

import ThemedText from './ThemedText'
import { embedUrl } from '../utils/videoUrl'

/**
 * Plays a how-to demo inside the app rather than handing it to the browser.
 *
 * The links in the catalog are YouTube watch/share URLs, which expo-video cannot
 * play - it wants a direct media file. So the player is YouTube's own iframe,
 * which needs a WebView on native and a real <iframe> on web (react-native-webview
 * has no web implementation). That platform split is the whole reason this
 * component exists; callers just hand it a url.
 */
const VideoEmbed = ({ url, style }: { url?: string, style?: StyleProp<ViewStyle> }) => {
    const src = embedUrl(url)

    if (!src) {
        return (
            <View style={[styles.frame, styles.fallback, style]}>
                <ThemedText style={styles.fallbackText}>
                    This demo can&apos;t be played in the app.
                </ThemedText>
            </View>
        )
    }

    if (Platform.OS === 'web') {
        // createElement because JSX in this file compiles to RN components, and
        // <iframe> is not one of them.
        return (
            <View style={[styles.frame, style]}>
                {createElement('iframe', {
                    src,
                    allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen',
                    allowFullScreen: true,
                    frameBorder: '0',
                    style: { width: '100%', height: '100%', border: 0 },
                })}
            </View>
        )
    }

    return (
        <View style={[styles.frame, style]}>
            <WebView
                source={{ uri: src }}
                style={styles.webview}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    frame: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    webview: {
        flex: 1,
        backgroundColor: '#000',
    },
    fallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallbackText: {
        color: '#fff',
        fontSize: 13,
    },
})

export default VideoEmbed
