#!/usr/bin/env node
// Copies chosen candidates from constants/videoCandidates.json into the catalog.
//
//   node scripts/promote-videos.js --dry              # preview, change nothing
//   node scripts/promote-videos.js                    # promote the top pick per exercise
//   node scripts/promote-videos.js --min-score 70     # be fussier
//   node scripts/promote-videos.js --fitting-only     # only 15-45s videos, never a long one
//   node scripts/promote-videos.js --overwrite        # replace existing videoUrls too
//
// The staging file is unreviewed search output, so this is the one deliberate
// step where a machine's guess becomes something a client sees. It is therefore
// --dry capable and refuses to touch records that already have a videoUrl unless
// told to, so a hand-picked demo is never silently replaced by a scored guess.
//
// Run validate-exercises.js afterwards - this script does not validate.

const fs = require('fs')
const path = require('path')

const { CLIP_SECONDS } = require('./videoSources')

const ROOT = path.join(__dirname, '..')
const CATALOG = path.join(ROOT, 'constants', 'exercises.json')
const CANDIDATES = path.join(ROOT, 'constants', 'videoCandidates.json')

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const value = (n, fallback) => {
    const i = args.indexOf(`--${n}`)
    return i === -1 ? fallback : Number(args[i + 1])
}

const dry = flag('dry')
const overwrite = flag('overwrite')
const fittingOnly = flag('fitting-only')
const minScore = value('min-score', 55)

if (!fs.existsSync(CANDIDATES)) {
    console.error(
        'No constants/videoCandidates.json. Harvest candidates first:\n' +
        '  python scripts/find-exercise-videos.py'
    )
    process.exit(2)
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'))
const staged = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'))
const byId = new Map(staged.exercises.map((row) => [row.id, row]))

const promoted = []
const skipped = []

for (const exercise of catalog) {
    const row = byId.get(exercise.id)
    if (!row) continue

    if (exercise.videoUrl && !overwrite) {
        skipped.push([exercise.id, 'already has a videoUrl'])
        continue
    }

    const eligible = row.candidates.filter((c) =>
        c.score >= minScore && (!fittingOnly || c.fitsWindow))

    if (!eligible.length) {
        const best = row.candidates[0]
        skipped.push([exercise.id, best
            ? `best candidate scored ${best.score}, below --min-score ${minScore}`
            : 'no candidates found'])
        continue
    }

    // Prefer a candidate that plays whole. A longer video is still promoted when
    // that is all there is, and verify-videos.js --online then reports it as
    // needing a clip window - a visible worklist rather than a silent gap.
    const pick = eligible.find((c) => c.fitsWindow) ?? eligible[0]

    if (!dry) {
        exercise.videoUrl = pick.url
        // No clip is invented here. Guessing which 30 seconds of a six-minute
        // video show the movement is exactly the judgement a script cannot make.
        delete exercise.clip
    }
    promoted.push({ id: exercise.id, pick })
}

if (!dry) {
    fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n')
}

// --- report -------------------------------------------------------------
const inWindow = promoted.filter((p) => p.pick.fitsWindow)
const needsClip = promoted.filter((p) => !p.pick.fitsWindow)

console.log(`${dry ? 'Would promote' : 'Promoted'} ${promoted.length} demo(s)` +
    ` (min-score ${minScore}${fittingOnly ? ', fitting only' : ''})`)
console.log(`  plays whole (${CLIP_SECONDS.min}-${CLIP_SECONDS.max}s): ${inWindow.length}`)
console.log(`  longer, needs a clip window:  ${needsClip.length}`)

if (needsClip.length) {
    console.log(`\nThese play too long until someone adds a clip window:`)
    for (const p of needsClip.slice(0, 25)) {
        console.log(`  ${p.id.padEnd(38)} ${String(p.pick.duration) + 's'} ${p.pick.url}`)
    }
    if (needsClip.length > 25) console.log(`  ... and ${needsClip.length - 25} more`)
}

const noCandidates = skipped.filter(([, why]) => why === 'no candidates found')
const belowScore = skipped.filter(([, why]) => why.startsWith('best candidate'))
const hadOne = skipped.filter(([, why]) => why.startsWith('already'))

console.log(`\nSkipped ${skipped.length}:`)
console.log(`  already had a demo:        ${hadOne.length}`)
console.log(`  below --min-score:         ${belowScore.length}`)
console.log(`  no candidates at all:      ${noCandidates.length}`)
if (belowScore.length) {
    console.log(`\nToo weak to promote automatically - worth a manual look:`)
    for (const [id, why] of belowScore.slice(0, 20)) console.log(`  ${id.padEnd(38)} ${why}`)
    if (belowScore.length > 20) console.log(`  ... and ${belowScore.length - 20} more`)
}

// In --dry nothing was written, so the count has to add what would have been.
const total = catalog.filter((ex) => ex.videoUrl).length + (dry ? promoted.length : 0)
console.log(`\nCatalog coverage${dry ? ' would be' : ''}: ${total}/${catalog.length}`)
if (!dry) console.log('Now run: node scripts/validate-exercises.js && npm run verify:videos')
