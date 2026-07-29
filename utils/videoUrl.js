// The catalog's `videoUrl` values are whatever form the link happened to be
// copied in - youtu.be share links, full watch URLs and /shorts links all appear.
// The embedded player needs the canonical /embed/{id} form, so the id is pulled
// out rather than the URL being used as-is.
const YOUTUBE_ID =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([A-Za-z0-9_-]{6,})/

export const youtubeId = (url) => {
    const match = String(url ?? '').match(YOUTUBE_ID)
    return match ? match[1] : null
}

/**
 * The embeddable player URL for a how-to link, or null if it isn't a YouTube
 * link we can embed - the caller shows a fallback rather than a broken frame.
 */
export const embedUrl = (url) => {
    const id = youtubeId(url)
    // `playsinline` stops iOS hijacking playback into its own fullscreen player.
    return id ? `https://www.youtube.com/embed/${id}?playsinline=1&rel=0` : null
}
