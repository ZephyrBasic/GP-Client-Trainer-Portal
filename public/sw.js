// GreenPulse service worker. Copied verbatim from public/ into dist/ by
// `expo export`, then stamped by scripts/fix-web-assets.js - see below.
//
// ## What this is for, and what it is not for
//
// One job: make the app *open and render* without a signal, instead of showing
// a blank page in a gym basement. It deliberately does not touch the data
// layer. Firestore keeps its own offline cache and the app derives its offline
// state from snapshot metadata (see CLAUDE.md, "Connectivity"); a service
// worker replaying stale Firestore or Auth responses would fight both. Every
// Firebase request is cross-origin, so the origin check in `fetch` below is
// what keeps this worker's hands off them - that check is load-bearing, not
// tidiness.
//
// ## Why there is no hand-written precache list
//
// The export content-hashes its filenames, so any list written here would name
// a bundle that stopped existing at the next build. So the list is not written
// here at all: scripts/fix-web-assets.js reads the finished export off disk
// and stamps the URLs in at the marker below. Nothing about the set of
// precached files is stated twice, so nothing about it can go stale.
//
// BUILD is stamped the same way, with a hash of those files' *contents* - so a
// build that changed nothing keeps its cache, and a build that changed
// anything at all, down to one icon, gets a fresh one.
//
// ## How an update lands
//
// A new build changes BUILD, which changes this file's bytes, which is what
// makes the browser treat it as a new worker at all. `skipWaiting` +
// `clients.claim` then put it in charge immediately rather than waiting for
// every tab to close - without them a tester who never fully quits the
// installed app would sit on the first build forever, which is the failure
// this whole thing exists to avoid. That is normally risky, because an open
// page can end up asking a new worker for a chunk that belongs to the old
// bundle; it is safe here because the export emits one entry bundle and no
// lazy chunks, so there are no follow-up requests to mismatch.
//
// HTML is network-first for the same reason: a cached index.html would pin
// testers to whichever build they installed, and index.html is the only thing
// that names the current bundle.
//
// Known failure mode: the very first visit has to happen online. The worker
// installs during that visit and precaches the shell, so offline works from
// then on - but a tester whose first ever load is offline gets nothing, and no
// service worker design can change that.

const BUILD = '__BUILD_ID__'
const CACHE = `greenpulse-${BUILD}`

// `npm run web` serves this file straight out of public/, unstamped - and the
// dev server's bundle URL never changes between edits, so a cache-first worker
// there pins the browser to whichever bundle it saw first and Fast Refresh
// appears to do nothing at all. An unstamped worker therefore stands down:
// it caches nothing, answers nothing, and removes itself and anything an
// earlier one cached. Tested by prefix rather than by comparing against the
// placeholder, because the stamp replaces the placeholder's first occurrence
// and `--check` fails a file that still contains one.
const STAMPED = !BUILD.startsWith('__')

// Every navigation in this single-page export resolves to the same index.html,
// so the shell is cached under one key and answers a navigation to any path.
const SHELL = '/'

const PRECACHE = [
    SHELL,
    /* __PRECACHE__ */
]

self.addEventListener('install', (event) => {
    if (!STAMPED) {
        event.waitUntil(self.skipWaiting())
        return
    }
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE)
            // Added one at a time rather than with `addAll`, which rejects as a
            // unit: one 404 would abort the install and leave the app with no
            // worker at all, where a cache that is missing one icon still opens
            // offline.
            await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
            await self.skipWaiting()
        })()
    )
})

self.addEventListener('activate', (event) => {
    if (!STAMPED) {
        event.waitUntil(
            (async () => {
                const keys = await caches.keys()
                await Promise.all(keys.map((key) => caches.delete(key)))
                await self.registration.unregister()
            })()
        )
        return
    }
    event.waitUntil(
        (async () => {
            const keys = await caches.keys()
            await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
            await self.clients.claim()
        })()
    )
})

const networkFirst = async (request) => {
    try {
        const response = await fetch(request)
        if (response.ok) {
            const cache = await caches.open(CACHE)
            cache.put(SHELL, response.clone())
        }
        return response
    } catch {
        const cached = await caches.match(SHELL)
        return cached ?? Response.error()
    }
}

const cacheFirst = async (request) => {
    const cached = await caches.match(request)
    if (cached) return cached

    const response = await fetch(request)
    // `basic` means a same-origin, non-opaque response. Caching an opaque or
    // errored one would poison the cache with something we cannot inspect.
    if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE)
        cache.put(request, response.clone())
    }
    return response
}

self.addEventListener('fetch', (event) => {
    if (!STAMPED) return
    const request = event.request
    if (request.method !== 'GET') return

    const url = new URL(request.url)

    // Cross-origin is everything that matters to correctness: Firebase Auth,
    // Firestore, Firebase Storage, YouTube. None of it may ever be served from
    // here, and letting those requests fall through untouched is the cheapest
    // guarantee of that.
    if (url.origin !== self.location.origin) return

    // Belt and braces for the same reason: `/__/` is Firebase's own reserved
    // path prefix. Nothing serves it on this host today, but if the app ever
    // moves to Firebase Hosting the auth handler would live there.
    if (url.pathname.startsWith('/__/')) return

    event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request))
})
