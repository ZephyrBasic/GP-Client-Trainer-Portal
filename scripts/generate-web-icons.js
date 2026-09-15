#!/usr/bin/env node
// Generates the PWA icon set (and the store icon) from one square source image.
//
//   node scripts/generate-web-icons.js
//   node scripts/generate-web-icons.js --source assets/img/gpLogo-black.png
//   node scripts/generate-web-icons.js --background '#080B09'
//   node scripts/generate-web-icons.js --dry
//
// ## Why this exists
//
// `assets/` ships one 1024x1024 icon, and a home-screen install needs four more
// sizes that no build step produces: iOS ignores the web manifest's icons
// entirely for Add to Home Screen and reads `<link rel="apple-touch-icon">`
// (180), Android's install prompt reads the manifest (192 and 512), and an
// Android launcher crops a *maskable* icon to whatever shape the device uses.
// Generated output is committed, so this runs when the artwork changes rather
// than on every build - a build-time step would mean every contributor and CI
// needed an image toolchain.
//
// ## Why jimp rather than sharp
//
// `sharp` is a native module: adding it would put a compiled dependency in
// package.json for an operation that runs a handful of times a year. `jimp` is
// pure JavaScript and is already on disk as a dependency of
// `@expo/image-utils`, which Expo itself installs. That is a transitive
// dependency and could in principle vanish under us, which is exactly why the
// resolve below fails with an instruction rather than a stack trace - the cost
// of that risk is one `npm i -D jimp`, paid only if it ever happens.
//
// ## The maskable icon
//
// Android guarantees only the centre circle of diameter 80% of a maskable
// icon; everything outside it may be cropped away by the launcher's mask. So
// the maskable variant is *not* the 512 with a different `purpose` - the
// artwork is scaled to 80% and centred on a filled square, which is the safe
// zone drawn honestly. Tagging the normal 512 as maskable instead is the
// common mistake and shows up as a cropped icon only on some devices.

const fs = require('fs')
const path = require('path')

let Jimp
try {
    Jimp = require('jimp-compact')
} catch {
    console.error(
        'jimp-compact is not installed. It normally arrives with @expo/image-utils;\n' +
            'if it has gone, run `npm i -D jimp` and change the require above to `jimp`.'
    )
    process.exit(1)
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`)
    return i === -1 ? fallback : args[i + 1]
}

const root = path.join(__dirname, '..')

// The source is a flag rather than a hard-coded path because the icon artwork
// is the thing most likely to change here. `assets/icon.png` is what app.json
// already points every native platform at, so the web install matches the
// native install by default.
const source = path.resolve(root, opt('source', 'assets/icon.png'))

const iconsDir = path.join(root, 'public', 'icons')
const storeIcon = path.join(root, 'assets', 'store-icon-1024.png')

// Android's maskable safe zone: the guaranteed-visible area is a circle of
// diameter 80% of the icon, so the artwork is inset to that.
const MASKABLE_SCALE = 0.8

const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/')

const main = async () => {
    if (!fs.existsSync(source)) {
        console.error(`No source image at ${rel(source)}.`)
        process.exit(1)
    }

    const src = await Jimp.read(source)
    const { width, height } = src.bitmap
    if (width !== height) {
        console.error(`${rel(source)} is ${width}x${height}. An app icon has to be square.`)
        process.exit(1)
    }

    // Default the fill to the source's own corner pixel rather than a palette
    // constant: it keeps the padded maskable icon and the flattened store icon
    // continuous with whatever artwork is passed in, so swapping a light source
    // for a dark one does not also need a second flag.
    const background = opt('background')
        ? Jimp.cssColorToHex(opt('background'))
        : src.getPixelColor(0, 0)

    // Flattening onto an opaque square is not cosmetic. iOS composites an
    // apple-touch-icon's transparency onto black, and App Store Connect rejects
    // a 1024 icon that carries an alpha channel at all - so every output here
    // is opaque by construction rather than by luck.
    const onBackground = (image, size) =>
        new Jimp(size, size, background).composite(image.clone().resize(size, size, Jimp.RESIZE_BICUBIC), 0, 0)

    const inset = Math.round(1024 * MASKABLE_SCALE)
    const maskableMaster = new Jimp(1024, 1024, background).composite(
        src.clone().resize(inset, inset, Jimp.RESIZE_BICUBIC),
        Math.round((1024 - inset) / 2),
        Math.round((1024 - inset) / 2)
    )

    const outputs = [
        // 180 is the only apple-touch-icon size worth shipping: iOS downscales
        // it for every other slot, and offering more sizes only adds bytes.
        { file: path.join(iconsDir, 'apple-touch-icon-180.png'), image: onBackground(src, 180) },
        { file: path.join(iconsDir, 'icon-192.png'), image: onBackground(src, 192) },
        { file: path.join(iconsDir, 'icon-512.png'), image: onBackground(src, 512) },
        { file: path.join(iconsDir, 'maskable-512.png'), image: maskableMaster.clone().resize(512, 512, Jimp.RESIZE_BICUBIC) },
        // Not under public/: this one never ships to the browser. It is the
        // square, un-rounded, alpha-free icon both stores ask to be uploaded
        // into the console - see docs/store-listing.md.
        { file: storeIcon, image: onBackground(src, 1024) },
    ]

    for (const { file, image } of outputs) {
        if (dry) {
            console.log(`Would write ${rel(file)}`)
            continue
        }
        fs.mkdirSync(path.dirname(file), { recursive: true })
        // colorType 2 is PNG truecolour *without* an alpha channel. Jimp writes
        // RGBA by default, which would leave a fully-opaque alpha channel on
        // the store icon - enough for App Store Connect to reject it.
        await image.colorType(2).writeAsync(file)
        console.log(`Wrote ${rel(file)} (${image.bitmap.width}x${image.bitmap.height})`)
    }

    console.log(`\nSource: ${rel(source)}; fill #${(background >>> 8).toString(16).padStart(6, '0')}`)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
