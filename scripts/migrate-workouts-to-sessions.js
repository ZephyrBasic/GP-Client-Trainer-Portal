#!/usr/bin/env node
// One-off migration: copy the `workouts` collection to `sessions`.
//
// A performed workout is a Session in the glossary and was a `workout` in the
// code. Renaming a Firestore collection is a copy, a verification and only then
// a delete - there is no rename operation and no server of ours to do it.
//
//   node scripts/migrate-workouts-to-sessions.js --dry             # report, write nothing
//   node scripts/migrate-workouts-to-sessions.js                   # copy workouts -> sessions
//   node scripts/migrate-workouts-to-sessions.js --verify          # compare the two, write nothing
//   node scripts/migrate-workouts-to-sessions.js --delete-source --dry
//   node scripts/migrate-workouts-to-sessions.js --delete-source   # verify, then delete workouts
//
// Run it in that order. Nothing here deletes anything unless --delete-source is
// passed, and even then the delete is refused unless every source document is
// present in the target with byte-identical fields.
//
// Exits non-zero on any failure, so it can be chained.
//
// Credentials: a service account, via GOOGLE_APPLICATION_CREDENTIALS. See
// resolveCredentialsPath() below for where it is looked for.

const fs = require('fs')
const path = require('path')

// firebase-admin v13+ moved the namespace. The root export is now the modular
// app API (initializeApp, cert) and Firestore lives on its own subpath, so the
// old admin.credential.cert() / admin.firestore() shape no longer exists.
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, Timestamp, GeoPoint, DocumentReference, FieldPath } = require('firebase-admin/firestore')

const SOURCE = 'workouts'
const TARGET = 'sessions'
const EXPECTED_PROJECT = 'gp-client-trainer-portal'

// Firestore caps a write batch at 500 operations. Paging the read at the same
// size keeps one page = at most one batch, so memory is bounded no matter how
// large the collection gets and a run never holds the whole collection at once.
// 400 rather than 500 to leave headroom if a later change adds a second write
// per document.
const PAGE = 400

const REPO_ROOT = path.join(__dirname, '..')

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const dry = flag('dry')
const verifyOnly = flag('verify')
const deleteSource = flag('delete-source')

const unknown = args.filter((a) => !['--dry', '--verify', '--delete-source'].includes(a))
if (unknown.length) {
    console.error(`Unknown argument(s): ${unknown.join(', ')}`)
    console.error('Usage: node scripts/migrate-workouts-to-sessions.js [--dry] [--verify] [--delete-source]')
    process.exit(1)
}

/**
 * The service account key path, from the environment or from .env.
 *
 * .env is parsed by hand rather than with dotenv, for the same reason
 * verify-videos.js does: nothing in scripts/ has a dependency at runtime beyond
 * what the migration itself needs, and the directory is built on running under
 * bare node. GOOGLE_APPLICATION_CREDENTIALS is deliberately not EXPO_PUBLIC_ -
 * it must never reach the bundle.
 */
const resolveCredentialsPath = () => {
    const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (fromEnv && fromEnv.trim()) return fromEnv.trim()

    try {
        const env = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8')
        const line = env.split(/\r?\n/).find((l) => /^\s*GOOGLE_APPLICATION_CREDENTIALS\s*=/.test(l))
        if (!line) return null
        const value = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
        return value || null
    } catch {
        return null
    }
}

const credentialsMissing = (detail) => {
    console.error('FATAL: no service account credentials.')
    if (detail) console.error(`  ${detail}`)
    console.error('')
    console.error('This migration talks to Firestore with the Admin SDK, which needs a service')
    console.error('account key. To get one:')
    console.error('')
    console.error(`  1. Firebase console -> project ${EXPECTED_PROJECT} -> Project settings ->`)
    console.error('     Service accounts -> Generate new private key.')
    console.error('  2. Save the downloaded JSON as secrets/service-account.json in this repo.')
    console.error('     secrets/ is gitignored; never commit the key.')
    console.error('  3. Add this line to .env (also gitignored):')
    console.error('')
    console.error('       GOOGLE_APPLICATION_CREDENTIALS=secrets/service-account.json')
    console.error('')
    console.error('  4. Re-run with --dry first.')
    process.exit(1)
}

const loadServiceAccount = () => {
    const configured = resolveCredentialsPath()
    if (!configured) credentialsMissing('GOOGLE_APPLICATION_CREDENTIALS is set neither in the environment nor in .env.')

    // A relative path in .env is relative to the repo, not to wherever the
    // script happens to be invoked from.
    const resolved = path.isAbsolute(configured) ? configured : path.join(REPO_ROOT, configured)

    let raw
    try {
        raw = fs.readFileSync(resolved, 'utf8')
    } catch {
        credentialsMissing(`GOOGLE_APPLICATION_CREDENTIALS points at ${resolved}, which does not exist or is unreadable.`)
    }

    if (!raw.trim()) {
        credentialsMissing(`${resolved} is empty. Copy the whole downloaded key over it, starting with {.`)
    }

    let parsed
    try {
        parsed = JSON.parse(raw)
    } catch {
        credentialsMissing(`${resolved} is not valid JSON. Re-download the key rather than editing it.`)
    }

    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
        credentialsMissing(`${resolved} is JSON but not a service account key (no project_id/private_key/client_email).`)
    }

    return { serviceAccount: parsed, resolved }
}

// --- value comparison ----------------------------------------------------

/**
 * Structural equality for Firestore values.
 *
 * JSON.stringify is not usable here: a Timestamp stringifies to `{}` under some
 * SDK versions and key order is not guaranteed, so two documents that differ
 * would compare equal. Everything the app stores today is a string, number,
 * boolean, null, Timestamp, array or map, but references, geopoints and bytes
 * are handled too so a field added later cannot silently pass verification.
 */
const sameValue = (a, b) => {
    if (a === b) return true
    if (a == null || b == null) return a == null && b == null

    if (a instanceof Timestamp || b instanceof Timestamp) {
        return a instanceof Timestamp && b instanceof Timestamp && a.isEqual(b)
    }
    if (a instanceof GeoPoint || b instanceof GeoPoint) {
        return a instanceof GeoPoint && b instanceof GeoPoint && a.isEqual(b)
    }
    if (a instanceof DocumentReference || b instanceof DocumentReference) {
        return (
            a instanceof DocumentReference &&
            b instanceof DocumentReference &&
            a.path === b.path
        )
    }
    if (Buffer.isBuffer(a) || Buffer.isBuffer(b)) {
        return Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.equals(b)
    }

    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
        return a.every((item, i) => sameValue(item, b[i]))
    }

    if (typeof a === 'object' && typeof b === 'object') {
        const keys = Object.keys(a)
        if (keys.length !== Object.keys(b).length) return false
        return keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]))
    }

    // NaN === NaN is false but two NaN-valued fields are the same stored value.
    return Number.isNaN(a) && Number.isNaN(b)
}

// --- paging --------------------------------------------------------------

/**
 * Walks a collection a page at a time, ordered by document id.
 *
 * The cursor is the last snapshot of the previous page rather than an offset, so
 * a run that is interrupted and restarted re-reads from the beginning and simply
 * finds the already-copied documents in place - there is no saved cursor to go
 * stale and no resume file to keep in sync. Ordering by id (rather than by a
 * field) is what makes that stable: it is the one ordering every document has,
 * needs no composite index, and does not shift when a document is written.
 */
const eachPage = async (db, name, onPage) => {
    let cursor = null
    let seen = 0

    for (;;) {
        let q = db.collection(name).orderBy(FieldPath.documentId()).limit(PAGE)
        if (cursor) q = q.startAfter(cursor)

        const snap = await q.get()
        if (snap.empty) return seen

        await onPage(snap.docs)
        seen += snap.docs.length
        cursor = snap.docs[snap.docs.length - 1]

        // A short page means the collection is exhausted; asking again would
        // cost a read to learn nothing.
        if (snap.docs.length < PAGE) return seen
    }
}

const countOf = async (db, name) => (await db.collection(name).count().get()).data().count

// --- phases --------------------------------------------------------------

/**
 * Copy every source document to the target under the same id.
 *
 * Idempotent by skipping any id that already exists in the target rather than
 * by overwriting it. Overwriting would be idempotent too, but only against a
 * target nobody else has touched: once the app is reading `sessions`, a re-run
 * would quietly roll a client's edited session back to the pre-migration copy.
 * Skipping cannot do that, and it also makes a second run the way to pick up
 * anything written to `workouts` after the first.
 */
const copy = async (db) => {
    let copied = 0
    let skipped = 0

    await eachPage(db, SOURCE, async (docs) => {
        // One getAll for the whole page rather than an exists() per document:
        // same answer, one round trip.
        const targets = await db.getAll(...docs.map((d) => db.collection(TARGET).doc(d.id)))
        const present = new Set(targets.filter((t) => t.exists).map((t) => t.id))

        const pending = docs.filter((d) => !present.has(d.id))
        skipped += docs.length - pending.length

        if (!pending.length) return

        if (dry) {
            pending.forEach((d) => console.log(`  would copy ${SOURCE}/${d.id} -> ${TARGET}/${d.id}`))
            copied += pending.length
            return
        }

        // set() rather than create(): create() would throw on a document that
        // appeared between the getAll above and this write, turning a benign
        // race into a failed run. The id was absent a moment ago, so this is a
        // create in all but name.
        const batch = db.batch()
        pending.forEach((d) => batch.set(db.collection(TARGET).doc(d.id), d.data()))
        await batch.commit()
        copied += pending.length
    })

    console.log('')
    console.log(dry ? `Would copy ${copied} document(s); ${skipped} already present.` : `Copied ${copied} document(s); ${skipped} already present.`)
    return { copied, skipped }
}

/**
 * Every source document is present in the target with identical fields.
 *
 * This is the gate on deletion, and it is deliberately a document-by-document
 * field comparison rather than a count check. Equal counts prove nothing: a
 * target could hold the right number of the wrong documents. The counts are
 * printed as well, because a human reading the output wants to see them.
 */
const verify = async (db) => {
    const sourceCount = await countOf(db, SOURCE)
    const targetCount = await countOf(db, TARGET)

    console.log(`  ${SOURCE}: ${sourceCount} document(s)`)
    console.log(`  ${TARGET}: ${targetCount} document(s)`)

    const missing = []
    const differing = []

    await eachPage(db, SOURCE, async (docs) => {
        const targets = await db.getAll(...docs.map((d) => db.collection(TARGET).doc(d.id)))
        const byId = new Map(targets.map((t) => [t.id, t]))

        docs.forEach((d) => {
            const target = byId.get(d.id)
            if (!target || !target.exists) {
                missing.push(d.id)
            } else if (!sameValue(d.data(), target.data())) {
                differing.push(d.id)
            }
        })
    })

    const show = (label, ids) => {
        if (!ids.length) return
        console.log(`  ${label}: ${ids.length}`)
        ids.slice(0, 20).forEach((id) => console.log(`    ${id}`))
        if (ids.length > 20) console.log(`    ... and ${ids.length - 20} more`)
    }

    show('not copied', missing)
    show('copied but differing', differing)

    const ok = missing.length === 0 && differing.length === 0
    console.log('')
    console.log(ok
        ? `Verified: all ${sourceCount} source document(s) present in ${TARGET} with identical fields.`
        : 'Verification FAILED.')

    // A target larger than the source is not an error - re-running after the app
    // has been switched over is expected to find newer sessions - but it is
    // worth saying out loud before anybody deletes anything.
    if (ok && targetCount > sourceCount) {
        console.log(`Note: ${TARGET} holds ${targetCount - sourceCount} document(s) with no counterpart in ${SOURCE}.`)
    }

    return { ok, sourceCount, targetCount }
}

/**
 * Delete the source collection, and only after verify() has passed.
 *
 * Every deleted document is one that was just confirmed present and identical in
 * the target, so an interrupted delete leaves a shorter `workouts` and a
 * complete `sessions` - re-running finishes the job. There is no window in which
 * a record exists in neither place.
 */
const drop = async (db) => {
    console.log(`Verifying before deleting anything from ${SOURCE}...`)
    const { ok } = await verify(db)
    if (!ok) {
        console.error('')
        console.error(`Refusing to delete ${SOURCE}: the copy is not complete. Re-run the copy first.`)
        process.exit(1)
    }

    console.log('')
    let deleted = 0

    await eachPage(db, SOURCE, async (docs) => {
        if (dry) {
            docs.forEach((d) => console.log(`  would delete ${SOURCE}/${d.id}`))
            deleted += docs.length
            return
        }
        const batch = db.batch()
        docs.forEach((d) => batch.delete(d.ref))
        await batch.commit()
        deleted += docs.length
    })

    // Under --dry nothing is removed, so the pager advances past each page as
    // usual. Without --dry each page is emptied behind us, which is fine: the
    // cursor is the last id of the page just handled, and ids only ever move
    // forward.
    console.log('')
    console.log(dry ? `Would delete ${deleted} document(s) from ${SOURCE}.` : `Deleted ${deleted} document(s) from ${SOURCE}.`)
}

// --- main ----------------------------------------------------------------

const main = async () => {
    const { serviceAccount, resolved } = loadServiceAccount()

    initializeApp({ credential: cert(serviceAccount) })
    const db = getFirestore()

    console.log(`Project: ${serviceAccount.project_id}`)
    console.log(`Key:     ${resolved}`)
    if (serviceAccount.project_id !== EXPECTED_PROJECT) {
        console.log(`WARNING: expected project ${EXPECTED_PROJECT}. Check the key before continuing.`)
    }
    if (dry) console.log('Mode:    DRY RUN - nothing will be written or deleted.')
    console.log('')

    if (verifyOnly) {
        console.log(`Comparing ${SOURCE} with ${TARGET}...`)
        const { ok } = await verify(db)
        process.exit(ok ? 0 : 1)
    }

    if (deleteSource) {
        await drop(db)
        return
    }

    console.log(`Copying ${SOURCE} -> ${TARGET}...`)
    await copy(db)

    // Only a real copy is verified. Verifying after a dry run would compare the
    // data as it stands - nothing was written - and report every document as
    // missing, which reads as a failure when it is the expected state.
    if (dry) {
        console.log('')
        console.log(`Dry run complete. Nothing was written. Counts as they stand:`)
        console.log(`  ${SOURCE}: ${await countOf(db, SOURCE)} document(s)`)
        console.log(`  ${TARGET}: ${await countOf(db, TARGET)} document(s)`)
        return
    }

    console.log('')
    console.log(`Comparing ${SOURCE} with ${TARGET}...`)
    const { ok } = await verify(db)
    if (!ok) process.exit(1)
}

main().catch((err) => {
    console.error('')
    console.error('FATAL:', err && err.message ? err.message : err)
    // Firestore surfaces a bad key or a disabled API as a permission error; say
    // so rather than leaving a stack trace to interpret.
    if (err && (err.code === 7 || err.code === 'permission-denied')) {
        console.error('The service account was accepted but denied access. Check it has the')
        console.error('Cloud Datastore User (or Firebase Admin) role on the project.')
    }
    process.exit(1)
})
