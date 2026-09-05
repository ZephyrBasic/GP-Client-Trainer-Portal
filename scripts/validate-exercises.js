#!/usr/bin/env node
// Validates constants/exercises.json against the v2 schema and the closed tag
// vocabularies in exerciseVocab.js.
//
//   node scripts/validate-exercises.js            # validate the bundled catalog
//   node scripts/validate-exercises.js --stats    # ... and print facet coverage
//   node scripts/validate-exercises.js path.json  # validate some other file
//
// Exits non-zero on any error, so it can gate a commit.

const fs = require('fs')
const path = require('path')

const { FIELDS, FACETS } = require('./exerciseVocab')
const { DEMO_SECONDS, isYouTube, isMediaFile, effectiveSeconds } = require('./videoSources')

const args = process.argv.slice(2)
const showStats = args.includes('--stats')
const target = args.find((a) => !a.startsWith('--')) ??
    path.join(__dirname, '..', 'constants', 'exercises.json')

const errors = []
const warnings = []
const fail = (id, msg) => errors.push(`${id}: ${msg}`)
const warn = (id, msg) => warnings.push(`${id}: ${msg}`)

/** A measurement baked into the name instead of into a logged set. */
const MEASURE_IN_NAME =
    /(^|[\s(])\d+\s*(k|km|m|cm|mi|"|''|s|sec|secs|min|mins|hr|hrs|reps?|x)\b|(^|\s)\d+["']/i

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SUPERSET_PREFIX = /^[A-Z]\d+\.\s*/

const exercises = JSON.parse(fs.readFileSync(target, 'utf8'))

if (!Array.isArray(exercises)) {
    console.error('FATAL: expected a top-level array')
    process.exit(1)
}

const seenIds = new Map()
const seenNames = new Map()
const facetCounts = Object.fromEntries(Object.keys(FACETS).map((f) => [f, {}]))

for (const [i, ex] of exercises.entries()) {
    const id = ex.id ?? `<index ${i}>`

    // --- id -------------------------------------------------------------
    if (typeof ex.id !== 'string' || !ex.id) fail(id, 'missing id')
    else {
        if (!SLUG.test(ex.id)) fail(id, 'id must be a lowercase hyphenated slug')
        if (seenIds.has(ex.id)) fail(id, `duplicate id (also at index ${seenIds.get(ex.id)})`)
        else seenIds.set(ex.id, i)
    }

    // --- name -----------------------------------------------------------
    if (typeof ex.name !== 'string' || !ex.name.trim()) fail(id, 'missing name')
    else {
        if (ex.name !== ex.name.trim()) fail(id, 'name has leading/trailing whitespace')
        if (/\s{2,}/.test(ex.name)) fail(id, 'name has a double space')
        if (SUPERSET_PREFIX.test(ex.name)) fail(id, `name carries a superset prefix: "${ex.name}"`)
        if (/^[^A-Za-z]/.test(ex.name)) fail(id, `name starts with a non-letter: "${ex.name}"`)
        if (MEASURE_IN_NAME.test(ex.name)) {
            fail(id, `name embeds a duration/distance/rep count: "${ex.name}"`)
        }
        if (ex.name.includes('/')) fail(id, `name is an either-or, split it: "${ex.name}"`)
        if (ex.name.includes('+')) fail(id, `name combines two movements, split it: "${ex.name}"`)
        // Abbreviations belong in the slug and aliases, spelled out in the name.
        const abbrev = ex.name.match(/\b(DB|BB|KB|SA|SL|OHP|WGS|SM|RDL)\b/)
        if (abbrev) fail(id, `name uses abbreviation "${abbrev[1]}" - spell it out`)

        const key = ex.name.toLowerCase()
        if (seenNames.has(key)) fail(id, `duplicate name (also ${seenNames.get(key)})`)
        else seenNames.set(key, ex.id)
    }

    // --- fields ---------------------------------------------------------
    if (!Array.isArray(ex.fields) || ex.fields.length === 0) fail(id, 'missing fields[]')
    else {
        for (const f of ex.fields) if (!FIELDS.includes(f)) fail(id, `unknown field "${f}"`)
        if (new Set(ex.fields).size !== ex.fields.length) fail(id, 'duplicate entries in fields[]')
        const ordered = FIELDS.filter((f) => ex.fields.includes(f))
        if (ordered.join() !== ex.fields.join()) {
            fail(id, `fields must be in canonical order: [${ordered.join(', ')}]`)
        }
    }

    // --- tags -----------------------------------------------------------
    if (!Array.isArray(ex.tags) || ex.tags.length === 0) fail(id, 'missing tags[]')
    else {
        const byFacet = {}
        for (const tag of ex.tags) {
            const [facet, ...rest] = tag.split(':')
            const value = rest.join(':')
            if (!rest.length) { fail(id, `tag "${tag}" is not facet:value`); continue }
            if (!FACETS[facet]) { fail(id, `unknown facet "${facet}" in "${tag}"`); continue }
            if (!FACETS[facet].includes(value)) { fail(id, `unknown value "${value}" for facet "${facet}"`); continue }
            ;(byFacet[facet] ??= []).push(value)
            facetCounts[facet][value] = (facetCounts[facet][value] ?? 0) + 1
        }
        if (new Set(ex.tags).size !== ex.tags.length) fail(id, 'duplicate tags')
        for (const required of ['modality', 'role', 'equipment']) {
            if (!byFacet[required]?.length) fail(id, `needs at least one ${required}: tag`)
        }
        // A resistance movement without a target muscle can't be filtered or
        // reported on, which is most of the point of the facets.
        if (byFacet.modality?.includes('resistance') && !byFacet.muscle?.length) {
            warn(id, 'resistance movement with no muscle: tag')
        }
    }

    // --- videoUrl / clip ------------------------------------------------
    // Optional: a how-to demo the client opens from the info button. Absent means
    // no demo exists yet - a gap to fill, but not a schema fault, so it stays a
    // warning-free absence here and is reported by verify-videos.js instead.
    //
    // Only the shape is checked here. Whether the video still exists, is
    // embeddable, runs 15-45s and comes from a vouched-for channel needs the
    // YouTube API, so it lives in verify-videos.js - this file must keep working
    // offline and stay fast enough to gate a commit.
    if (ex.videoUrl !== undefined) {
        if (typeof ex.videoUrl !== 'string' || !/^https:\/\/\S+$/.test(ex.videoUrl)) {
            fail(id, `videoUrl must be an https URL, got ${JSON.stringify(ex.videoUrl)}`)
        } else {
            // A `t=`/`start=` timestamp on a watch URL is silently dropped when the
            // link is rewritten to /embed/{id}, so the intent behind it is lost.
            // `clip` is where a start time belongs.
            const stamped = ex.videoUrl.match(/[?&](t|start)=/)
            if (stamped) {
                fail(id, `videoUrl carries a "${stamped[1]}=" timestamp the player ignores - use clip instead`)
            }
            if (/[?&]si=/.test(ex.videoUrl)) {
                warn(id, 'videoUrl has a "si=" share-tracking param - safe to strip')
            }
            if (!isYouTube(ex.videoUrl) && !isMediaFile(ex.videoUrl)) {
                fail(id, `videoUrl is neither a YouTube link nor a playable media file: ${ex.videoUrl}`)
            }
        }
    }

    // --- durationSeconds --------------------------------------------------
    // How long `videoUrl` actually runs, learned from yt-dlp at harvest time and
    // written into the record so the house rule is enforceable offline.
    //
    // Before this existed the only offline length signal was whether the link
    // said /shorts/, which YouTube caps at three minutes - so a 2m50s demo
    // passed every check we could run without an API key. See docs/adr/0006.
    //
    // Its absence is not a fault: 309 records predate the field and are simply
    // of unknown length. Naming them is verify-videos.js's job, which owns the
    // worklist; this file stays schema-only so it can gate a commit.
    if (ex.durationSeconds !== undefined) {
        if (!Number.isInteger(ex.durationSeconds) || ex.durationSeconds <= 0) {
            fail(id, `durationSeconds must be a whole number of seconds > 0, got ${JSON.stringify(ex.durationSeconds)}`)
        }
        if (ex.videoUrl === undefined) fail(id, 'durationSeconds without a videoUrl to measure')
    }

    if (ex.clip !== undefined) {
        const { start, end } = ex.clip ?? {}
        const whole = (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0

        if (typeof ex.clip !== 'object' || ex.clip === null || Array.isArray(ex.clip)) {
            fail(id, 'clip must be an object { start, end }')
        } else if (Object.keys(ex.clip).sort().join() !== 'end,start') {
            fail(id, `clip takes exactly start and end, got [${Object.keys(ex.clip).join(', ')}]`)
        } else if (!whole(start) || !whole(end)) {
            fail(id, 'clip.start and clip.end must be whole seconds >= 0')
        } else if (end <= start) {
            fail(id, `clip.end (${end}) must be after clip.start (${start})`)
        } else if (end - start > DEMO_SECONDS.max) {
            fail(id, `clip runs ${end - start}s, over the ${DEMO_SECONDS.max}s house rule`)
        }

        if (ex.videoUrl === undefined) fail(id, 'clip without a videoUrl to clip')
        // Self-hosted footage is trimmed before upload, so a window here would be
        // a second, contradictable way of saying the same thing.
        else if (!isYouTube(ex.videoUrl)) fail(id, 'clip only applies to a YouTube videoUrl')
    }

    // What a client actually watches: the clip window if there is one, the whole
    // video if there is not. A long video is still allowed - but only with a clip
    // window trimming it, which is the difference between a demo and a lecture.
    const effective = effectiveSeconds(ex)
    if (effective !== null && effective > DEMO_SECONDS.max) {
        fail(id, `demo plays ${effective}s, over the ${DEMO_SECONDS.max}s house rule` +
            (ex.clip ? '' : ' - trim it with a clip window, or pick a shorter demo'))
    }

    // --- no v1 leftovers ------------------------------------------------
    // typicalSets/typicalReps are deliberately gone: a new set starts empty and is
    // prefilled from this client's own last performance, not from a catalog default.
    // `aliases` was dropped too: it carried spreadsheet spelling variants that
    // earned their keep at import time and nothing after it.
    for (const dead of ['type', 'category', 'typicalSets', 'typicalReps', 'aliases']) {
        if (dead in ex) fail(id, `v1 field "${dead}" still present`)
    }
    const known = new Set(['id', 'name', 'fields', 'tags', 'videoUrl', 'durationSeconds', 'clip'])
    for (const k of Object.keys(ex)) if (!known.has(k)) fail(id, `unknown property "${k}"`)
}

// --- report -------------------------------------------------------------
if (showStats) {
    console.log(`${exercises.length} exercises\n`)
    for (const [facet, values] of Object.entries(facetCounts)) {
        const rows = Object.entries(values).sort((a, b) => b[1] - a[1])
        const unused = FACETS[facet].filter((v) => !values[v])
        console.log(`${facet}:  ${rows.map(([v, c]) => `${v}(${c})`).join(' ')}`)
        if (unused.length) console.log(`  unused: ${unused.join(', ')}`)
        console.log()
    }
}

for (const w of warnings) console.warn(`WARN  ${w}`)
for (const e of errors) console.error(`ERROR ${e}`)

console.log(
    `\n${path.relative(process.cwd(), target)}: ${exercises.length} exercises, ` +
    `${errors.length} error(s), ${warnings.length} warning(s)`
)
process.exit(errors.length ? 1 : 0)
