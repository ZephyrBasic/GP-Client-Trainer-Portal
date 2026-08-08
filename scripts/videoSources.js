// What counts as an acceptable how-to demo. Single source of truth for
// scripts/verify-videos.js, in the same spirit as exerciseVocab.js.
//
// Plain .js with no imports so it runs under bare node, like everything in here.

/**
 * The house rule on length: long enough to show the movement, short enough that
 * a client watches it mid-session instead of skipping it.
 *
 * Measured on *effective* length - a clip window's `end - start` if it has one,
 * the video's full duration if it doesn't.
 */
const CLIP_SECONDS = { min: 15, max: 45 }

/**
 * Channels whose coaching Zeph has watched and vouches for, keyed by YouTube
 * channelId. A video from anywhere else fails verification: "reputable" is not
 * something an API can judge, so it reduces to "from a channel on this list",
 * which is a judgement a human made once and a script can then enforce forever.
 *
 * Deliberately seeded empty rather than guessed at. Populate it from clips you
 * have already chosen:
 *
 *   node scripts/verify-videos.js --learn
 *
 * which prints the channelId and title behind every videoUrl in the catalog, so
 * you approve real channels by pasting real ids instead of trusting a list
 * someone else assembled. The value is a human label, only ever used in output.
 */
const APPROVED_CHANNELS = {
    // 'UC.......................': 'Squat University',
}

/**
 * Skip the allowlist check entirely while the list is still empty.
 *
 * Without this, the very first --online run would flag all 317 records as
 * disreputable and bury the checks that actually found something. Once you
 * approve a single channel the gate switches itself on.
 */
const enforceChannels = () => Object.keys(APPROVED_CHANNELS).length > 0

// --- URL shapes ---------------------------------------------------------
// Mirrors utils/videoUrl.ts. Duplicated rather than imported because scripts/
// stays plain .js so it runs under bare node with no build step, the same trade
// already made for exerciseVocab.js. If you change a pattern, change it there
// too - the app and the validator disagreeing about what a video is would let a
// record pass validation and then render a fallback.
const YOUTUBE_ID =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{6,})/

const MEDIA_FILE = /\.(mp4|m4v|mov|webm)$/i

const youtubeId = (url) => {
    const match = String(url ?? '').match(YOUTUBE_ID)
    return match ? match[1] : null
}

const isYouTube = (url) => youtubeId(url) !== null

/** Firebase Storage hides the extension behind percent-encoding and a query. */
const isMediaFile = (url) => {
    try {
        return MEDIA_FILE.test(decodeURIComponent(new URL(url).pathname))
    } catch {
        return false
    }
}

/** ISO-8601 duration as returned by the YouTube API (`PT1M30S`), in seconds. */
const parseIsoDuration = (iso) => {
    const m = String(iso ?? '').match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
    if (!m) return null
    const [, d, h, min, s] = m.map((v) => (v === undefined ? 0 : Number(v)))
    return d * 86400 + h * 3600 + min * 60 + s
}

module.exports = {
    CLIP_SECONDS,
    APPROVED_CHANNELS,
    enforceChannels,
    youtubeId,
    isYouTube,
    isMediaFile,
    parseIsoDuration,
}
