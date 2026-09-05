// What counts as an acceptable how-to demo. Single source of truth for
// scripts/verify-videos.js, in the same spirit as exerciseVocab.js.
//
// Plain .js with no imports so it runs under bare node, like everything in here.

/**
 * The house rule on length: short enough that a client watches it mid-session
 * instead of skipping it.
 *
 * Measured on *effective* length - a clip window's `end - start` if it has one,
 * the video's full duration if it doesn't.
 *
 * There is deliberately no minimum. The old rule floored this at 15s and the
 * harvester penalised anything under it as "too short to show the movement",
 * which is false: a calf raise is fully demonstrated in eight seconds, and the
 * floor was rejecting the tightest clips on the strength of a guess about
 * length rather than about content. Whether a demo shows enough is a judgement
 * a person makes while watching it, and scripts/review-catalog.js is where
 * they make it. See docs/adr/0006.
 */
const DEMO_SECONDS = { max: 60 }

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

/**
 * Whether the link is a YouTube Short.
 *
 * No longer a length signal. It used to be the only one available offline, and
 * it was a bad one: YouTube caps a Short at three *minutes*, so a 2m50s clip
 * satisfied it while running nearly three times the house rule, and no offline
 * check could ever have noticed. Records now carry the real `durationSeconds`,
 * learned from yt-dlp at harvest time and written into the catalog, so length
 * is checked against the actual number.
 *
 * What it still says, and all it says, is that the demo is shaped like a Short -
 * vertical, wordless, one movement - which is what makes it worth ranking up
 * during a harvest.
 */
const isShortsUrl = (url) => /youtube[.]com\/shorts\//.test(String(url ?? ''))

/**
 * How many seconds of video a client actually watches, or null if unknown.
 *
 * A clip window's span when the record has one, the video's own duration when
 * it doesn't. Shared rather than reimplemented because validate-exercises.js,
 * verify-videos.js and review-catalog.js all have to agree on it - three
 * slightly different answers to "how long is this demo" is how the 15-45s rule
 * came to be enforced in two places and checked in neither.
 *
 * null means the record predates `durationSeconds` and has never been through a
 * harvest. That is reported as unknown, never as a pass.
 */
const effectiveSeconds = (exercise) => {
    if (exercise?.clip) return exercise.clip.end - exercise.clip.start
    return typeof exercise?.durationSeconds === 'number' ? exercise.durationSeconds : null
}

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
    DEMO_SECONDS,
    APPROVED_CHANNELS,
    enforceChannels,
    youtubeId,
    isYouTube,
    isShortsUrl,
    isMediaFile,
    parseIsoDuration,
    effectiveSeconds,
}
