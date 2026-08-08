import { useCallback, useEffect, useRef, useState } from 'react'
import {
    Modal, Pressable, StyleSheet, View, useWindowDimensions,
    type LayoutChangeEvent, type StyleProp, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ScreenOrientation from 'expo-screen-orientation'
import YoutubeIframe, { type YoutubeIframeRef } from 'react-native-youtube-iframe'

import { Spinner, videoStyles } from './VideoFrame'
import { youtubeId, type VideoClip } from '../utils/videoUrl'

/**
 * The native how-to player. Web takes YouTubePlayer.web.tsx instead - Metro picks
 * per platform, and this file is the default because the library has no usable web
 * build (its web path needs react-native-web-webview, which we do not install).
 *
 * This is a library rather than our own WebView because getting a YouTube embed to
 * play inside a WebView is genuinely fiddly, and we lost three rounds to it:
 * pointing a WebView at the embed URL makes it a top-level document, which YouTube
 * refuses ("Error 153: Video player configuration error"); framing it from a page
 * whose origin claims to be youtube.com is refused differently ("152: This video is
 * unavailable"). The library frames the player from a real third-party origin it
 * hosts, and sets a desktop User-Agent, which is the combination that works.
 * If video breaks again, suspect this contract before suspecting our code.
 *
 * Fullscreen is ours, not the player's (`preventFullScreen`, which also disables the
 * WebView's own `allowsFullscreenVideo`). Android hands WebView fullscreen to the
 * *Activity's* decor view, while a React Native <Modal> is a separate Dialog window
 * above that Activity - the two do not compose, and pressing the player's own button
 * tore ExerciseInfoModal down and dropped the client back on the picker. Every route
 * here is inside a Modal, so the fix is to never hand off: the expanded player below
 * is plain React views inside the same window, which Android has no opinion about.
 */
const YouTubePlayer = ({ url, clip, style }: {
    url: string,
    clip?: VideoClip,
    style?: StyleProp<ViewStyle>,
}) => {
    // The library wants pixel dimensions, not a style, so the frame is measured
    // and the 16:9 height derived from it rather than set by aspectRatio.
    const [width, setWidth] = useState(0)
    const [ready, setReady] = useState(false)
    const [fullscreen, setFullscreen] = useState(false)
    // Where a remounted player should pick up, and whether it should start itself.
    const [startAt, setStartAt] = useState(clip?.start ?? 0)
    const [autoplay, setAutoplay] = useState(false)

    const playerRef = useRef<YoutubeIframeRef | null>(null)
    const window = useWindowDimensions()
    const insets = useSafeAreaInsets()

    const videoId = youtubeId(url)

    /**
     * Swap between the inline and expanded player.
     *
     * React Native has no portals, so the two are different positions in the tree
     * and the WebView is genuinely remounted - the video would otherwise rewind to
     * the start every time someone expands it. Reading the current time first and
     * feeding it back as the new start point makes the reload look like a resume.
     */
    const setExpanded = useCallback(async (next: boolean) => {
        try {
            const at = await playerRef.current?.getCurrentTime()
            if (typeof at === 'number' && Number.isFinite(at)) {
                setStartAt(Math.max(clip?.start ?? 0, Math.floor(at)))
                setAutoplay(true)
            }
        } catch {
            // A player that never became ready has no time to report; starting the
            // new one from the top is the right fallback.
        }
        setReady(false)
        setFullscreen(next)
    }, [clip])

    useEffect(() => {
        ScreenOrientation.lockAsync(
            fullscreen
                ? ScreenOrientation.OrientationLock.LANDSCAPE
                : ScreenOrientation.OrientationLock.PORTRAIT_UP
        ).catch(() => {})
    }, [fullscreen])

    // Closing the info screen while expanded would otherwise strand the whole app
    // in landscape, since nothing else ever unlocks it.
    useEffect(() => () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
    }, [])

    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

    const player = (w: number, h: number) => (
        <YoutubeIframe
            ref={playerRef}
            videoId={videoId as string}
            width={w}
            height={h}
            play={autoplay}
            // `start`/`end` are how a clip window reaches the native player; the web
            // branch puts the same numbers in the embed URL.
            initialPlayerParams={{
                rel: false,
                modestbranding: true,
                preventFullScreen: true,
                start: startAt || undefined,
                ...(clip ? { end: clip.end } : null),
            }}
            onReady={() => setReady(true)}
            // Surfaces as the frame simply never becoming ready, so the spinner
            // stays - better than a silent black box.
            onError={() => setReady(true)}
            webViewProps={{ allowsInlineMediaPlayback: true }}
        />
    )

    // Fit 16:9 inside whatever the rotated window turns out to be, rather than
    // assuming landscape is wider than 16:9 - tablets and split screen are not.
    const fsWidth = Math.min(window.width, Math.round((window.height * 16) / 9))
    const fsHeight = Math.round((fsWidth * 9) / 16)

    return (
        <>
            <View style={[videoStyles.frame, style]} onLayout={onLayout}>
                {!fullscreen && videoId && width > 0 ? player(width, Math.round((width * 9) / 16)) : null}
                {!fullscreen && !ready ? <Spinner /> : null}
                {!fullscreen && videoId ? (
                    <Pressable
                        onPress={() => setExpanded(true)}
                        style={styles.expand}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Watch fullscreen"
                    >
                        <Ionicons name="expand" size={17} color="#fff" />
                    </Pressable>
                ) : null}
            </View>

            <Modal
                visible={fullscreen}
                animationType="fade"
                onRequestClose={() => setExpanded(false)}
                // iOS ignores orientation locks for a Modal unless it is told which
                // orientations the Modal itself supports.
                supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
                statusBarTranslucent
            >
                <View style={styles.fsRoot}>
                    {videoId ? player(fsWidth, fsHeight) : null}
                    {ready ? null : <Spinner />}
                    <Pressable
                        onPress={() => setExpanded(false)}
                        style={[styles.fsClose, { top: insets.top + 10, left: insets.left + 10 }]}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Exit fullscreen"
                    >
                        <Ionicons name="contract" size={22} color="#fff" />
                    </Pressable>
                </View>
            </Modal>
        </>
    )
}

const styles = StyleSheet.create({
    expand: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    fsRoot: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fsClose: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
})

export default YouTubePlayer
