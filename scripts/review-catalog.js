#!/usr/bin/env node
// The human review pass over constants/exercises.json.
//
//   node scripts/review-catalog.js            # opens the review page in your browser
//   node scripts/review-catalog.js --port 9000
//   node scripts/review-catalog.js --all      # revisit records already decided
//
// validate-exercises.js answers "is this record well-formed?". Nothing answered
// "is this record *right*?" - whether the name is what a trainer would call the
// movement, whether the fields match how it is actually measured, whether the
// demo shows the exercise at all. That is a judgement, it needs eyes on all 317
// records, and this is the tool that makes sitting through them bearable.
//
// Why a local page and not a CLI: the reviewable content is a video. A terminal
// can print a URL, but then every record costs a tab-switch, a play, and a
// tab-close, and 317 of those is an afternoon of friction rather than review.
//
// Why it writes the catalog directly: the alternative is a verdict file that
// something later replays into exercises.json, which is a second source of
// truth for the same fact and a migration waiting to happen. Every decision
// lands in the catalog as it is made; git is the undo.
//
// Plain .js under bare node with no dependencies, like everything in scripts/.
// The page it serves is a sibling .html file rather than a template literal in
// here, so the markup stays editable as markup.

const fs = require('fs')
const http = require('http')
const path = require('path')
const { execFile } = require('child_process')

const { DEMO_SECONDS } = require('./videoSources')
const { FIELDS, FACETS } = require('./exerciseVocab')

const ROOT = path.join(__dirname, '..')
const CATALOG = path.join(ROOT, 'constants', 'exercises.json')
const CANDIDATES = path.join(ROOT, 'constants', 'videoCandidates.json')
const PAGE = path.join(__dirname, 'review-catalog.html')

// Review state lives in .claude/ rather than next to the catalog: it is working
// notes for one pass, gitignored and disposable, not something a reader of the
// repo needs. The catalog itself carries every decision that outlives the pass.
const STATE = path.join(ROOT, '.claude', 'review-state.json')
const FLAGS = path.join(ROOT, '.claude', 'exercise-flags.json')

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`)
    return i === -1 ? fallback : argv[i + 1]
}
const PORT = Number(arg('port', 8090))
const reviewAll = argv.includes('--all')
// Skipping is "decide later", so there has to be a way back to them. Without
// this the only route is --all, which starts at record 1 and walks the whole
// catalog to reach the two you deferred.
const skippedOnly = argv.includes('--skipped')

const readJson = (file, fallback) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
        return fallback
    }
}

/**
 * The schema's key order, so an edited record diffs as a one-line change rather
 * than as a reshuffle of the whole object.
 */
const KEY_ORDER = ['id', 'name', 'fields', 'tags', 'videoUrl', 'durationSeconds', 'clip']
const ordered = (ex) => {
    const out = {}
    for (const key of KEY_ORDER) if (ex[key] !== undefined) out[key] = ex[key]
    // Anything unrecognised is kept rather than silently dropped - the validator
    // is what rejects it, and losing data here would hide the problem instead.
    for (const key of Object.keys(ex)) if (!(key in out)) out[key] = ex[key]
    return out
}

/**
 * Write through a temp file and rename, so an interrupt mid-write cannot leave
 * a truncated catalog. Same trade as the harvester's staging file.
 */
const writeJson = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
    fs.renameSync(tmp, file)
}

let catalog = readJson(CATALOG, null)
if (!Array.isArray(catalog)) {
    console.error(`Could not read ${path.relative(ROOT, CATALOG)}`)
    process.exit(1)
}

const staged = readJson(CANDIDATES, { exercises: [] })
const stagedById = new Map((staged.exercises || []).map((row) => [row.id, row]))
const flags = readJson(FLAGS, {})
let state = readJson(STATE, { version: 1, decisions: {} })
state.decisions ??= {}

if (!stagedById.size) {
    console.warn(
        'No constants/videoCandidates.json - every record will show only its current demo.\n' +
        'Harvest alternatives first:  python scripts/find-exercise-videos.py --all\n'
    )
}

/**
 * What the page needs to render one record: the record itself, every demo it
 * could have, whatever the flag pass said about it, and any verdict already
 * recorded.
 *
 * Candidates are ordered so the ones that satisfy the house rule come first,
 * best-scoring within that. A longer video is still offered - sometimes it is
 * the only footage of a movement - but it sorts below everything playable, and
 * the page marks it as needing a clip window.
 */
const buildQueue = () => catalog.filter((exercise) =>
    !skippedOnly || state.decisions[exercise.id]?.verdict === 'skipped'
).map((exercise) => {
    const row = stagedById.get(exercise.id)
    const seen = new Set()
    const candidates = []

    if (exercise.videoUrl) {
        seen.add(exercise.videoUrl)
        // The harvest usually re-finds the demo already in the catalog, and that
        // row is the richer one - it carries the duration and title this record
        // has never had. Merge rather than dedupe it away, or the current demo
        // shows as "length unknown" and sorts below the house rule it may well
        // satisfy.
        const rediscovered = (row?.candidates ?? []).find((c) => c.url === exercise.videoUrl)
        candidates.push({
            url: exercise.videoUrl,
            title: rediscovered?.title ?? '(the demo currently in the catalog)',
            duration: exercise.durationSeconds ?? rediscovered?.duration ?? null,
            channel: rediscovered?.channel ?? null,
            score: rediscovered?.score ?? null,
            current: true,
        })
    }

    for (const c of (row?.candidates ?? [])) {
        if (seen.has(c.url)) continue
        seen.add(c.url)
        candidates.push({
            url: c.url,
            title: c.title,
            duration: c.duration ?? null,
            channel: c.channel,
            score: c.score,
            current: false,
        })
    }

    const rank = (c) => {
        const fits = c.duration !== null && c.duration <= DEMO_SECONDS.max
        // Unknown length sorts with the too-long ones: it has not been shown to
        // satisfy the rule, and claiming otherwise is what the old /shorts/
        // heuristic did.
        return fits ? 0 : 1
    }
    candidates.sort((a, b) => rank(a) - rank(b) || (b.score ?? -Infinity) - (a.score ?? -Infinity))

    return {
        exercise: ordered(exercise),
        candidates,
        flags: flags[exercise.id] ?? null,
        decision: state.decisions[exercise.id] ?? null,
    }
})

const payload = () => ({
    maxSeconds: DEMO_SECONDS.max,
    fields: FIELDS,
    facets: FACETS,
    // Both modes put already-decided records in front of you, so neither should
    // skip past them looking for an undecided one.
    reviewAll: reviewAll || skippedOnly,
    queue: buildQueue(),
    deleted: Object.entries(state.decisions)
        .filter(([, d]) => d.verdict === 'deleted')
        .map(([id, d]) => ({ id, name: d.record?.name })),
})

/**
 * Apply one verdict.
 *
 * Accept and edit are the same operation with different amounts filled in: the
 * page always sends the record as it stands, so "accept unchanged" and "accept
 * with a corrected name" do not need to be told apart here.
 */
const decide = (body) => {
    const { id, verdict } = body
    const index = catalog.findIndex((ex) => ex.id === id)
    if (index === -1) return { ok: false, error: `no record ${id}` }

    const at = new Date().toISOString()

    if (verdict === 'deleted') {
        // The whole record goes into the state file. Recovering a delete should
        // not require reading a git diff to reconstruct what was there.
        state.decisions[id] = { verdict, at, record: catalog[index] }
        catalog.splice(index, 1)
    } else if (verdict === 'skipped') {
        state.decisions[id] = { verdict, at }
    } else if (verdict === 'accepted') {
        const next = { ...catalog[index] }

        if (typeof body.name === 'string' && body.name.trim()) next.name = body.name.trim()
        if (Array.isArray(body.fields) && body.fields.length) next.fields = body.fields
        if (Array.isArray(body.tags) && body.tags.length) next.tags = body.tags

        if (body.videoUrl) {
            next.videoUrl = body.videoUrl
            if (typeof body.durationSeconds === 'number' && body.durationSeconds > 0) {
                next.durationSeconds = body.durationSeconds
            } else {
                // A demo whose length nobody established must not keep the
                // previous video's number - that would be a confident wrong
                // answer, which is the exact failure this field exists to end.
                delete next.durationSeconds
            }

            // A clip window, for the 27 movements with no footage under the house
            // rule. Mostly they are not single movements at all - Run, Swim,
            // Vinyasa Flow - but a few genuinely overshoot by seconds, and
            // trimming those beats rejecting the only good demo of the lift.
            const clip = body.clip
            if (clip && Number.isInteger(clip.start) && Number.isInteger(clip.end) &&
                clip.end > clip.start) {
                next.clip = { start: clip.start, end: clip.end }
            } else {
                delete next.clip
            }
        } else if (body.videoUrl === null) {
            // Deliberately demo-less. Some records are activities rather than
            // movements, and a how-to video of running teaches nobody anything -
            // an empty videoUrl is the right answer, not a gap to fill later.
            delete next.videoUrl
            delete next.durationSeconds
            delete next.clip
        }

        catalog[index] = ordered(next)
        state.decisions[id] = { verdict, at, videoUrl: next.videoUrl ?? null }
    } else {
        return { ok: false, error: `unknown verdict ${verdict}` }
    }

    writeJson(CATALOG, catalog)
    writeJson(STATE, state)
    return { ok: true }
}

const send = (res, status, body, type = 'application/json') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return send(res, 200, fs.readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8')
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
        return send(res, 200, payload())
    }

    if (req.method === 'POST' && url.pathname === '/api/decide') {
        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', () => {
            let result
            try {
                result = decide(JSON.parse(raw))
            } catch (err) {
                result = { ok: false, error: String(err && err.message) }
            }
            send(res, result.ok ? 200 : 400, result)
        })
        return
    }

    send(res, 404, { error: 'not found' })
})

// An earlier sitting's server is usually still running, and the default node
// failure for that is an unhandled 'error' event and a ten-line stack trace,
// which reads like a bug in the tool rather than "you already have one open".
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            `Port ${PORT} is already in use - a review server from an earlier sitting is\n` +
            `probably still running. Every decision it made is already saved, so it is\n` +
            `safe to stop. Either open the one you have at http://localhost:${PORT},\n` +
            `or stop it and start again:\n\n` +
            (process.platform === 'win32'
                ? `  powershell -c "Get-NetTCPConnection -LocalPort ${PORT} -State Listen | ` +
                  `ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"\n`
                : `  kill $(lsof -ti tcp:${PORT})\n`) +
            `\nor run this one on a different port:  --port ${PORT + 1}`
        )
        process.exit(1)
    }
    throw err
})

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`
    const queued = buildQueue().length
    const undecided = catalog.filter((ex) => !state.decisions[ex.id]).length
    console.log(
        skippedOnly
            ? `Reviewing the ${queued} record(s) you skipped, of ${catalog.length} in the catalog`
            : `Reviewing ${queued} exercises - ${undecided} still undecided`
    )
    console.log(`  ${url}`)
    console.log('  ctrl-c when you want to stop; progress is saved after every record.')

    if (argv.includes('--no-open')) return
    const opener = process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : process.platform === 'darwin'
          ? ['open', [url]]
          : ['xdg-open', [url]]
    execFile(opener[0], opener[1], () => {})
})
