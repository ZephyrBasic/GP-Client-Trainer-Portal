#!/usr/bin/env node
// The post-export pass over dist/. Two jobs, both of which exist because the
// export on its own produces something that is subtly wrong rather than
// visibly broken:
//
//   1. Moves the web export's assets out from under a `node_modules` path, so
//      Cloudflare Pages will actually upload them.
//   2. Stamps the service worker with the precache list and build id it cannot
//      know until the export exists.
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

const crypto = require('crypto')
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

// Wrapped in a function rather than run at the top level because the service
// worker below has to be stamped on every run, including the runs where there
// is nothing to move.
const moveAssets = () => {
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
        return
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
}

// ## Stamping the service worker
//
// public/sw.js ships with a placeholder build id and an empty precache list,
// because neither can be known before the export runs: every bundle filename
// is content-hashed. Rather than have the worker guess, this pass reads the
// finished export and writes the real list in - so the set of precached files
// is stated exactly once, on disk, and cannot drift from what was built.
//
// The stamp is always applied to a fresh copy of public/sw.js rather than to
// whatever is already in dist/, which is what keeps this step idempotent: a
// second run re-derives the same answer instead of trying to re-stamp an
// already-stamped file.
//
// Deliberately runs *after* the asset move above, so the hashes below are
// taken over the bytes that will actually be served.

const swTemplate = path.join(__dirname, '..', 'public', 'sw.js')
const swOutput = path.join(dist, 'sw.js')

const BUILD_PLACEHOLDER = '__BUILD_ID__'
const PRECACHE_MARKER = '/* __PRECACHE__ */'

// What the worker needs in order to open and render with no signal: the HTML
// shell, the entry bundle (and any CSS the export emits), the manifest and the
// install icons. Fonts and images are deliberately absent - the app requests
// every font on its first frame, so the worker's runtime cache-first path has
// them after one online visit anyway, and precaching ~600 kB of them would
// only make that first visit slower.
const precacheTargets = () => {
    const urls = []
    const collect = (dir) => {
        if (!fs.existsSync(dir)) return
        for (const file of walk(dir)) {
            urls.push('/' + path.relative(dist, file).split(path.sep).join('/'))
        }
    }
    if (fs.existsSync(path.join(dist, 'manifest.json'))) urls.push('/manifest.json')
    collect(path.join(dist, 'icons'))
    collect(path.join(dist, '_expo', 'static'))
    return urls.sort()
}

const stampServiceWorker = () => {
    if (!fs.existsSync(swTemplate)) return

    if (!fs.existsSync(swOutput)) {
        console.error(
            `public/sw.js exists but ${path.relative(process.cwd(), swOutput)} does not - the export ` +
                'did not copy public/. The app will have no offline start.'
        )
        process.exit(1)
    }

    const stamped = fs.readFileSync(swOutput, 'utf8')
    if (check) {
        if (stamped.includes(BUILD_PLACEHOLDER) || stamped.includes(PRECACHE_MARKER)) {
            console.error(
                `${path.relative(process.cwd(), swOutput)} is unstamped. It would never invalidate its ` +
                    'cache - run `node scripts/fix-web-assets.js`.'
            )
            process.exit(1)
        }
        console.log(`${path.relative(process.cwd(), swOutput)} is stamped.`)
        return
    }

    const urls = precacheTargets()
    const shell = path.join(dist, 'index.html')

    // A hash of the precached files' *contents*, not of their names. A build
    // that genuinely changed nothing produces the same id and testers keep
    // their warm cache; a build that changed anything - a re-hashed bundle, an
    // edited manifest, one redrawn icon - produces a new one, and the old
    // cache is deleted on activate. Content rather than mtime because an
    // export writes every file every time.
    const digest = crypto.createHash('sha256')
    for (const file of [shell, ...urls.map((url) => path.join(dist, url))]) {
        if (fs.existsSync(file)) digest.update(fs.readFileSync(file))
    }
    const build = digest.digest('hex').slice(0, 12)

    const source = fs
        .readFileSync(swTemplate, 'utf8')
        .replace(BUILD_PLACEHOLDER, build)
        .replace(PRECACHE_MARKER, urls.map((url) => `'${url}',`).join('\n    '))

    if (dry) {
        console.log(`Would stamp sw.js as build ${build} with ${urls.length + 1} precached file(s).`)
        return
    }

    fs.writeFileSync(swOutput, source)
    console.log(`Stamped sw.js as build ${build} with ${urls.length + 1} precached file(s).`)
}

moveAssets()
stampServiceWorker()
