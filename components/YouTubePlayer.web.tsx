import { createElement, useState } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import { Spinner, videoStyles } from './VideoFrame'
import { embedUrl, type VideoClip } from '../utils/videoUrl'

// Chrome sizes a fullscreen element against its nearest ancestor carrying a CSS
// transform rather than against the viewport. React Native Web puts an identity
// transform - matrix(1,0,0,1,0,0), visually a no-op - on ScrollView, so a
// fullscreened video inherited the scroll viewport's box: measured at
// 1280x571 at (0,61) against a 1280x631 viewport, i.e. offset by the header and
// short by its height, which is glaring on a phone. Clearing transforms on the
// fullscreen element's own ancestors, and only while something is actually
// fullscreen, frees it without disturbing normal scrolling.
if (typeof document !== 'undefined' && !document.getElementById('gp-fullscreen-transform-fix')) {
    const fix = document.createElement('style')
    fix.id = 'gp-fullscreen-transform-fix'
    fix.textContent = '*:has(:fullscreen) { transform: none !important; }'
    document.head.appendChild(fix)
}

/**
 * The web how-to player. Native takes YouTubePlayer.tsx instead.
 *
 * A real <iframe> rather than the native library, because that library's web build
 * needs react-native-web-webview, and because on web the plain embed URL already
 * works: it genuinely sits in an iframe on the app's own origin, which is the
 * arrangement YouTube's player expects and the whole difficulty on native.
 */
const YouTubePlayer = ({ url, clip, style }: {
    url: string,
    clip?: VideoClip,
    style?: StyleProp<ViewStyle>,
}) => {
    const [ready, setReady] = useState(false)
    const src = embedUrl(url, clip)

    return (
        <View style={[videoStyles.frame, style]}>
            {/* createElement because JSX in this file compiles to RN components,
                and <iframe> is not one of them. */}
            {src ? createElement('iframe', {
                src,
                allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen',
                allowFullScreen: true,
                frameBorder: '0',
                onLoad: () => setReady(true),
                style: { width: '100%', height: '100%', border: 0 },
            }) : null}
            {ready ? null : <Spinner />}
        </View>
    )
}

export default YouTubePlayer
