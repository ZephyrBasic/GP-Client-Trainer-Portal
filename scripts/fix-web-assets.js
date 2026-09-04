#!/usr/bin/env node
// Moves the web export's assets out from under a `node_modules` path, so
// Cloudflare Pages will actually upload them.
//
//   node scripts/fix-web-assets.js          # rewrite dist/ in place
//   node scripts/fix-web-assets.js --dry    # report what it would do
//   node scripts/fix-web-assets.js --check  # exit non-zero if dist/ still needs fixing
//   node scripts/fix-web-assets.js path/to/dist
//
// ## Why this exists
//
// `expo export -p web` names every asset by its path from the project root, so
// a font that lives in a package is emitted as
//
//   dist/assets/node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.<hash>.ttf
//
// and the bundle asks for it at that URL. **Cloudflare Pages skips
// `node_modules` when it uploads a build output**, so not one of those files
// reaches the CDN. Nothing 404s, which is what made this hard to see: with no
// top-level 404.html in the export, Pages answers an unmatched path with
// index.html, so every font request came back as 200 text/html - 1216 bytes of
// HTML shell that the browser silently fails to parse as a font.
//
// The symptom is the whole app rendering in the system serif with tofu boxes
// where the icons should be, on web only. Every font in the app arrives this
// way - both Google families and the Ionicons glyph file - because all of them
// come from packages, which is why it reads as "the web build is missing its
// styles" rather than as one missing file. Device builds are unaffected: they
// bundle their assets rather than fetching them from a host.
//
// ## What it does
//
// Renames the one directory and rewrites the references to it. Deliberately a
// post-export step rather than a change to how the app loads fonts: vendoring
// the .ttf files into assets/ would fix the two Google families but not
// Ionicons, which @expo/vector-icons resolves out of its own package, and would
// leave the same trap set for the next package that ships an asset.
//
// Idempotent, so running it twice is harmless and running it on an export that
// has already been fixed does nothing.

const fs = require('fs')
const path = require('path')

// `pkg` rather than anything cleverer: short, obviously not a source directory,
// and - the only requirement that matters - not a name Pages excludes.
const FROM = 'node_modules'
const TO = 'pkg'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const dry = flag('dry')
const check = flag('check')

const dist = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(__dirname, '..', 'dist'))
const assetsRoot = path.join(dist, 'assets')
const from = path.join(assetsRoot, FROM)
const to = path.join(assetsRoot, TO)

if (!fs.existsSync(dist)) {
    console.error(`No export at ${dist}. Run \`npx expo export -p web\` first.`)
    process.exit(1)
}

const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else out.push(full)
    }
    return out
}

const needsFix = fs.existsSync(from)

if (!needsFix) {
    // Either already fixed, or an export with no package assets at all. Say
    // which, because "nothing to do" is reassuring for the wrong reason if the
    // assets simply were not emitted.
    const fixed = fs.existsSync(to)
    console.log(
        fixed
            ? `${path.relative(process.cwd(), to)} is already in place - nothing to do.`
            : `No assets under ${path.relative(process.cwd(), assetsRoot)}/${FROM} - nothing to do.`
    )
    process.exit(0)
}

if (check) {
    console.error(
        `${path.relative(process.cwd(), from)} still exists. Cloudflare Pages will not upload it - ` +
            'run `node scripts/fix-web-assets.js`.'
    )
    process.exit(1)
}

const moved = walk(from).length

// Every text file the export emits that could name an asset URL. The bundle is
// where they actually live (each asset's `httpServerLocation`), but index.html
// and the metadata are cheap to sweep and would be silently stale otherwise.
const rewritable = walk(dist).filter((file) => /[.](js|html|json|map|css)$/.test(file))

let rewrittenFiles = 0
let rewrittenRefs = 0
for (const file of rewritable) {
    const before = fs.readFileSync(file, 'utf8')
    const after = before.split(`assets/${FROM}/`).join(`assets/${TO}/`)
    if (after === before) continue

    rewrittenFiles++
    rewrittenRefs += before.split(`assets/${FROM}/`).length - 1
    if (!dry) fs.writeFileSync(file, after)
}

if (!dry) {
    fs.renameSync(from, to)

    // A package that ships its own nested dependency would emit
    // assets/node_modules/a/node_modules/b/..., and the single rename above
    // would leave that inner segment behind - uploaded nowhere, referenced by a
    // URL that now points at the wrong place. Nothing in this project produces
    // one, but failing loudly beats shipping the same invisible 200-that-isn't.
    const nested = walk(to).filter((file) => file.split(path.sep).includes(FROM))
    if (nested.length > 0) {
        console.error(`\n${nested.length} asset(s) are still under a nested ${FROM}/ directory, e.g.`)
        console.error(`  ${path.relative(dist, nested[0])}`)
        console.error('These will not be uploaded. This script only handles one level.')
        process.exit(1)
    }
}

console.log(
    `${dry ? 'Would move' : 'Moved'} ${moved} asset(s) to assets/${TO}/ and ` +
        `${dry ? 'rewrite' : 'rewrote'} ${rewrittenRefs} reference(s) across ${rewrittenFiles} file(s).`
)
