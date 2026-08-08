// Turns a catalog `videoUrl` into something a player can actually take.
//
// Two kinds of demo coexist in the catalog on purpose. Borrowed YouTube clips
// give complete coverage today; Zeph's own footage, uploaded to Firebase
// Storage, replaces them one exercise at a time. Both live in the same
// `videoUrl` field, so nothing needs migrating as that swap happens - the kind
// is worked out from the URL rather than stored alongside it.

/** A window of a longer video, in seconds. YouTube only - see `clip` below. */
export type VideoClip = { start: number, end: number }

export type VideoSource =
    /** Plays in YouTube's own iframe player: a WebView on native, an <iframe> on web. */
    | { kind: 'youtube', uri: string }
    /** A direct media file, playable by expo-video on every platform. */
    | { kind: 'file', uri: string }

// The catalog's YouTube values are whatever form the link happened to be copied
// in - youtu.be share links, full watch URLs and /shorts links all appear. The
// embedded player needs the canonical /embed/{id} form, so the id is pulled out
// rather than the URL being used as-is.
const YOUTUBE_ID =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{6,})/

const MEDIA_FILE = /\.(mp4|m4v|mov|webm)$/i

export const youtubeId = (url?: string): string | null => {
    const match = String(url ?? '').match(YOUTUBE_ID)
    return match ? match[1] : null
}

/**
 * True for a URL expo-video can play directly.
 *
 * Firebase Storage download URLs carry the object path percent-encoded in the
 * pathname and a `?alt=media&token=...` query, so the extension is only visible
 * after decoding and dropping the query - hence not a plain `endsWith`.
 */
const isMediaFile = (url: string): boolean => {
    try {
        const { pathname } = new URL(url)
        return MEDIA_FILE.test(decodeURIComponent(pathname))
    } catch {
        return false
    }
}

/**
 * The embeddable player URL for a YouTube how-to, or null if it isn't a YouTube
 * link - the caller falls back rather than showing a broken frame.
 *
 * A `clip` narrows playback to the seconds that actually show the movement,
 * which is what lets a six-minute breakdown serve as a 30-second demo.
 */
export const embedUrl = (url?: string, clip?: VideoClip): string | null => {
    const id = youtubeId(url)
    if (!id) return null

    // `playsinline` stops iOS hijacking playback into its own fullscreen player.
    const params = ['playsinline=1', 'rel=0']
    if (clip) params.push(`start=${Math.floor(clip.start)}`, `end=${Math.ceil(clip.end)}`)

    return `https://www.youtube.com/embed/${id}?${params.join('&')}`
}

/**
 * What kind of video this is and the URI to hand the matching player, or null if
 * it's neither an embeddable YouTube link nor a media file we can play.
 *
 * YouTube is tested first: a `.mov` in a video title would otherwise be enough
 * to send a watch URL down the file branch.
 */
export const videoSource = (url?: string, clip?: VideoClip): VideoSource | null => {
    if (!url) return null

    const embed = embedUrl(url, clip)
    if (embed) return { kind: 'youtube', uri: embed }

    // Self-hosted clips are trimmed in the editor before upload, so a clip
    // window is meaningless here and the validator rejects the combination.
    if (isMediaFile(url)) return { kind: 'file', uri: url }

    return null
}
