import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'

import ThemedText from './ThemedText'
import YouTubePlayer from './YouTubePlayer'
import { videoStyles } from './VideoFrame'
import { videoSource, type VideoClip } from '../utils/videoUrl'

/**
 * Plays a how-to demo inside the app rather than handing it to the browser.
 *
 * Two players, because the catalog holds two kinds of demo. Borrowed YouTube clips
 * cannot go through expo-video - it wants a direct media file - so they go to
 * YouTubePlayer, which is itself split per platform (see those files; getting a
 * YouTube embed to play in a native WebView is the fiddly part). Zeph's own footage
 * in Firebase Storage *is* a direct media file, so it takes expo-video everywhere
 * and gets native controls for free.
 *
 * Callers just hand over a url and an optional clip window; which player runs is
 * derived from the url in utils/videoUrl.ts.
 */
const VideoEmbed = ({ url, clip, style }: {
    url?: string,
    clip?: VideoClip,
    style?: StyleProp<ViewStyle>,
}) => {
    const source = videoSource(url, clip)

    if (!source) {
        return (
            <View style={[videoStyles.frame, videoStyles.centered, style]}>
                <ThemedText style={{ color: '#fff', fontSize: 13 }}>
                    This demo can&apos;t be played in the app.
                </ThemedText>
            </View>
        )
    }

    if (source.kind === 'youtube') {
        return <YouTubePlayer url={url as string} clip={clip} style={style} />
    }

    // Its own component, not a branch here, because useVideoPlayer is a hook and
    // cannot be called conditionally.
    return <FileVideo uri={source.uri} style={style} />
}

/** A self-hosted clip. Loops, because a 30-second demo is worth watching twice. */
const FileVideo = ({ uri, style }: { uri: string, style?: StyleProp<ViewStyle> }) => {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true
        p.muted = true
    })

    return (
        <View style={[videoStyles.frame, style]}>
            <VideoView
                player={player}
                style={videoStyles.fill}
                contentFit="contain"
                allowsFullscreen
                nativeControls
            />
        </View>
    )
}

export default VideoEmbed
