#!/usr/bin/env node
// Checks the how-to demos in constants/exercises.json.
//
//   node scripts/verify-videos.js             # coverage report, no network
//   node scripts/verify-videos.js --missing   # ... and list every exercise with no demo
//   node scripts/verify-videos.js --long      # list demos that are neither a Short nor clipped - OFFLINE
//   node scripts/verify-videos.js --oembed    # check every video is live and embeddable - NO API KEY
//   node scripts/verify-videos.js --online    # also verify each video against the YouTube API
//   node scripts/verify-videos.js --learn     # print the channel behind each video, to build the allowlist
//   node scripts/verify-videos.js --json      # machine-readable output
//
// Separate from validate-exercises.js on purpose. That one is the commit gate:
// offline, instant, schema-only. This one needs the network and an API key, so it
// can neither gate a commit nor run in CI without a secret - it is something you
// run deliberately, every few months, to catch demos that have rotted.
//
// Exits non-zero if any check fails, so it can still gate a release if you want.

const fs = require('fs')
const path = require('path')

const {
    CLIP_SECONDS,
    APPROVED_CHANNELS,
    enforceChannels,
    youtubeId,
    isYouTube,
    isShortsUrl,
    isMediaFile,
    parseIsoDuration,
} = require('./videoSources')

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const online = flag('online') || flag('learn')
const asJson = flag('json')

const target = args.find((a) => !a.startsWith('--')) ??
    path.join(__dirname, '..', 'constants', 'exercises.json')

const exercises = JSON.parse(fs.readFileSync(target, 'utf8'))

const problems = []
const warnings = []
const note = (id, msg) => problems.push({ id, msg })
// Warnings never affect the exit code - they order a human's review queue rather
// than asserting anything is broken.
const warn = (id, msg) => warnings.push({ id, msg })

// --- coverage -----------------------------------------------------------
const withVideo = exercises.filter((ex) => ex.videoUrl)
const missing = exercises.filter((ex) => !ex.videoUrl)
const youtube = withVideo.filter((ex) => isYouTube(ex.videoUrl))
const selfHosted = withVideo.filter((ex) => isMediaFile(ex.videoUrl) && !isYouTube(ex.videoUrl))
const clipped = withVideo.filter((ex) => ex.clip)

/**
 * Demos that are probably too long to be watched mid-set: a full YouTube video,
 * with no clip window trimming it and no /shorts/ in the link to suggest it is
 * brief on its own.
 *
 * Computed offline, which is the point. The real length check needs an API key
 * (--online), so until now "which demos are too long?" could not be asked at
 * all without one - and the answer is the re-harvest worklist. It never fails
 * the run: a two-minute video can still be the right demo, and only a person
 * watching it can say.
 */
const tooLong = youtube.filter((ex) => !ex.clip && !isShortsUrl(ex.videoUrl))

/**
 * The API key, from the environment or from .env.
 *
 * .env is parsed by hand rather than with dotenv: nothing else in scripts/ has a
 * dependency and adding one for four lines would break the "runs under bare
 * node" property the whole directory is built on.
 */
const apiKey = () => {
    if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY
    try {
        const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
        const line = env.split(/\r?\n/).find((l) => /^\s*YOUTUBE_API_KEY\s*=/.test(l))
        return line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : null
    } catch {
        return null
    }
}

/**
 * Liveness and embeddability for every demo, with no API key at all.
 *
 * YouTube's oEmbed endpoint answers 200 only for a video that is public *and*
 * embeddable, and 401/404 otherwise - which is exactly the pair of failures that
 * show a client a dead player. It cannot report duration or channelId, so it is
 * not a replacement for --online; it is the check that is always available.
 *
 * It also returns the video's *current* title, which is what makes the
 * title-mismatch triage below possible.
 */
const checkOembed = async (rows, concurrency = 8) => {
    const alive = new Map()
    const queue = [...rows]

    const worker = async () => {
        while (queue.length) {
            const row = queue.shift()
            const url = 'https://www.youtube.com/oembed?format=json&url=' +
                encodeURIComponent(row.videoUrl)
            try {
                const res = await fetch(url)
                if (!res.ok) {
                    note(row.id, res.status === 401
                        ? 'video exists but embedding is disabled, so it cannot play in-app'
                        : `video is gone or private (oEmbed ${res.status})`)
                    continue
                }
                alive.set(row.id, await res.json())
            } catch (err) {
                note(row.id, `could not reach YouTube: ${err.message}`)
            }
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker))
    return alive
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'with', 'to', 'on', 'in', 'of', 'for'])

// Same rule as utils/exerciseSearch.ts: catalog names are singular by convention
// and video titles almost never are ("Banded Rows", "Wrist Curls"). Without this
// every such pair looked like a mismatch, which was most of the first run's
// warnings and made the list not worth reading.
const singular = (word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)

/** Content words plus glued adjacent pairs - mirrors find-exercise-videos.py. */
const signature = (text) => {
    const seq = (String(text ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? []).map(singular)
    const set = new Set(seq.filter((w) => !STOP_WORDS.has(w)))
    for (let i = 0; i + 1 < seq.length; i++) set.add(seq[i] + seq[i + 1])
    return set
}

/**
 * How much of the exercise name the video's title accounts for.
 *
 * A low score means the search landed on something else wearing a similar name -
 * "Wall Ball" matching a playground game, "Dumbbell Shoulder Over" matching a
 * shoulder press. Reported as a warning, never a failure: plenty of good demos
 * are titled nothing like the catalog, so this orders a review queue rather than
 * deciding anything.
 */
const titleMatch = (name, title) => {
    const needed = signature(name)
    const have = signature(title)
    let hit = 0
    for (const w of needed) if (have.has(w)) hit++
    return needed.size ? hit / needed.size : 1
}

/** videos.list costs 1 quota unit per call and takes 50 ids, so 317 records is ~7 units. */
const fetchVideos = async (ids, key) => {
    const found = new Map()

    for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50)
        const url = 'https://www.googleapis.com/youtube/v3/videos' +
            `?part=snippet,contentDetails,status&id=${batch.join(',')}&key=${key}`

        const res = await fetch(url)
        if (!res.ok) {
            const body = await res.text().catch(() => '')
            throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`)
        }
        const json = await res.json()
        for (const item of json.items ?? []) found.set(item.id, item)
    }

    return found
}

const main = async () => {
    let learned = null
    let oembedChannels = null

    if (flag('oembed')) {
        const alive = await checkOembed(youtube)
        oembedChannels = {}

        for (const ex of youtube) {
            const meta = alive.get(ex.id)
            if (!meta) continue                      // already reported by checkOembed
            oembedChannels[meta.author_name] = (oembedChannels[meta.author_name] ?? 0) + 1

            const match = titleMatch(ex.name, meta.title)
            if (match < 0.4) {
                warn(ex.id, `title may be a different exercise: "${meta.title}" (${meta.author_name})`)
            }
        }
    }

    if (online) {
        const key = apiKey()
        if (!key) {
            console.error(
                'No YOUTUBE_API_KEY found in the environment or .env.\n' +
                'Create one at https://console.cloud.google.com/apis/credentials with the\n' +
                'YouTube Data API v3 enabled. The checks below cost ~7 of the 10,000 free\n' +
                'daily quota units, so it is effectively free to run.'
            )
            process.exit(2)
        }

        const ids = [...new Set(youtube.map((ex) => youtubeId(ex.videoUrl)))]
        const found = await fetchVideos(ids, key)
        learned = new Map()

        for (const ex of youtube) {
            const vid = youtubeId(ex.videoUrl)
            const item = found.get(vid)

            // Absent from the response is how the API reports deleted and private
            // videos alike - there is no error, the id simply does not come back.
            // This is the failure that matters most: it is silent in the app, where
            // the client just sees a dead player.
            if (!item) {
                note(ex.id, `video ${vid} is gone (deleted, private, or a bad id)`)
                continue
            }

            const { snippet, contentDetails, status } = item
            learned.set(snippet.channelId, snippet.channelTitle)

            if (status.privacyStatus !== 'public') {
                note(ex.id, `video is ${status.privacyStatus}, not public`)
            }
            // Embeddable is off by default on some channels' uploads, and there is no
            // way to tell from the watch page - only from here.
            if (status.embeddable === false) {
                note(ex.id, 'channel has disabled embedding, so it cannot play in-app')
            }

            const duration = parseIsoDuration(contentDetails.duration)
            if (duration === null) {
                note(ex.id, `unparseable duration "${contentDetails.duration}"`)
            } else {
                if (ex.clip && ex.clip.end > duration) {
                    note(ex.id, `clip ends at ${ex.clip.end}s but the video is only ${duration}s long`)
                }
                const effective = ex.clip ? ex.clip.end - ex.clip.start : duration
                if (effective < CLIP_SECONDS.min || effective > CLIP_SECONDS.max) {
                    note(ex.id,
                        `plays ${effective}s, outside the ${CLIP_SECONDS.min}-${CLIP_SECONDS.max}s window` +
                        (ex.clip ? '' : ` - add a clip window to trim it`))
                }
            }

            if (contentDetails.regionRestriction) {
                note(ex.id, 'video is region-restricted, so some clients may not see it')
            }

            if (enforceChannels() && !APPROVED_CHANNELS[snippet.channelId]) {
                note(ex.id,
                    `channel "${snippet.channelTitle}" (${snippet.channelId}) is not in APPROVED_CHANNELS`)
            }
        }
    }

    // --- report ---------------------------------------------------------
    if (asJson) {
        console.log(JSON.stringify({
            total: exercises.length,
            withVideo: withVideo.length,
            youtube: youtube.length,
            selfHosted: selfHosted.length,
            clipped: clipped.length,
            missing: missing.map((ex) => ex.id),
            problems,
        }, null, 2))
        process.exit(problems.length ? 1 : 0)
    }

    if (flag('learn')) {
        console.log('Channels behind the current demos - paste the ones you vouch for into')
        console.log('scripts/videoSources.js APPROVED_CHANNELS:\n')
        const rows = [...learned.entries()].sort((a, b) => a[1].localeCompare(b[1]))
        for (const [channelId, title] of rows) {
            const mark = APPROVED_CHANNELS[channelId] ? '  (already approved)' : ''
            console.log(`    '${channelId}': '${title.replace(/'/g, "\\'")}',${mark}`)
        }
        console.log()
    }

    const pct = ((withVideo.length / exercises.length) * 100).toFixed(1)
    console.log(`Coverage: ${withVideo.length}/${exercises.length} exercises have a demo (${pct}%)`)
    console.log(`  YouTube: ${youtube.length}   self-hosted: ${selfHosted.length}   clipped: ${clipped.length}`)
    if (tooLong.length) {
        console.log(
            `  ${tooLong.length} are full-length videos with no clip window - ` +
            'pass --long to list them'
        )
    }
    if (!enforceChannels()) {
        console.log('  APPROVED_CHANNELS is empty, so the reputable-source check is off.')
    }
    if (!online) {
        console.log('  (offline: pass --online to check the videos still exist and are the right length)')
    }

    if (flag('long') && tooLong.length) {
        console.log(`
${tooLong.length} full-length demos - trim with a clip window, or re-harvest as a Short:`)
        for (const ex of tooLong) console.log(`  ${ex.id.padEnd(40)} ${ex.videoUrl}`)
    }

    if (flag('missing') && missing.length) {
        console.log(`\n${missing.length} without a demo:`)
        for (const ex of missing) console.log(`  ${ex.id.padEnd(40)} ${ex.name}`)
    }

    if (oembedChannels) {
        const rows = Object.entries(oembedChannels).sort((a, b) => b[1] - a[1]).slice(0, 15)
        console.log(`\nChannels in use (top ${rows.length}):`)
        for (const [name, n] of rows) console.log(`  ${String(n).padStart(4)}  ${name}`)
    }

    if (warnings.length) {
        console.log(`\n${warnings.length} to eyeball first - the title does not look like the exercise:`)
        for (const w of warnings) console.warn(`WARN  ${w.id}: ${w.msg}`)
    }

    if (problems.length) {
        console.log()
        for (const p of problems) console.error(`FAIL  ${p.id}: ${p.msg}`)
    }

    console.log(`\n${problems.length} problem(s), ${warnings.length} warning(s)`)
    process.exit(problems.length ? 1 : 0)
}

main().catch((err) => {
    console.error(err.message)
    process.exit(2)
})
