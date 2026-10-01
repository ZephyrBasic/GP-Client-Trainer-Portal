#!/usr/bin/env node
// One-off migration: write inviteCodes/{code} for every existing Trainer.
//
// Client registration now looks a Trainer up by fetching inviteCodes/{code}
// instead of querying `users`, so `users` can close to strangers. Trainers who
// registered before that change have a code on their profile and no lookup
// document, and until this runs nobody can sign up as their Client.
//
//   node scripts/backfill-invite-codes.js --dry    # report, write nothing
//   node scripts/backfill-invite-codes.js          # write the missing lookups
//
// Order: this, then the new firestore.rules, then the app, then this again.
// The old app queries `users` by inviteCode, which the new rules refuse; the
// new app fetches inviteCodes/, which the old rules deny. Either way round there
// is a short window where Client signup fails, and a Trainer who registers on
// the old app inside it gets no lookup - the second run catches them.
//
// Idempotent. A lookup that already points at the right Trainer is left alone.
// Two Trainers sharing one code, or a lookup pointing at someone else, is
// reported and skipped rather than resolved - picking a winner would silently
// re-route one Trainer's future Clients - and makes the run exit non-zero.
//
// Credentials: a service account, via GOOGLE_APPLICATION_CREDENTIALS, the same
// way as migrate-workouts-to-sessions.js.

const fs = require('fs')
const path = require('path')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const EXPECTED_PROJECT = 'gp-client-trainer-portal'
const REPO_ROOT = path.join(__dirname, '..')

const args = process.argv.slice(2)
const dry = args.includes('--dry')

const unknown = args.filter((a) => a !== '--dry')
if (unknown.length) {
    console.error(`Unknown argument(s): ${unknown.join(', ')}`)
    console.error('Usage: node scripts/backfill-invite-codes.js [--dry]')
    process.exit(1)
}

// .env parsed by hand, as in every other script here: they run under bare node.
const resolveCredentialsPath = () => {
    const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (fromEnv && fromEnv.trim()) return fromEnv.trim()
    try {
        const env = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8')
        const line = env.split(/\r?\n/).find((l) => /^\s*GOOGLE_APPLICATION_CREDENTIALS\s*=/.test(l))
        if (!line) return null
        return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') || null
    } catch {
        return null
    }
}

const loadServiceAccount = () => {
    const configured = resolveCredentialsPath()
    if (!configured) {
        console.error('FATAL: GOOGLE_APPLICATION_CREDENTIALS is set neither in the environment nor in .env.')
        console.error('See scripts/migrate-workouts-to-sessions.js for how to get a key.')
        process.exit(1)
    }
    const resolved = path.isAbsolute(configured) ? configured : path.join(REPO_ROOT, configured)
    try {
        const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'))
        if (!parsed.project_id || !parsed.private_key) throw new Error('not a service account key')
        return { serviceAccount: parsed, resolved }
    } catch (e) {
        console.error(`FATAL: could not load ${resolved}: ${e.message}`)
        process.exit(1)
    }
}

const main = async () => {
    const { serviceAccount, resolved } = loadServiceAccount()
    initializeApp({ credential: cert(serviceAccount) })
    const db = getFirestore()

    console.log(`Project: ${serviceAccount.project_id}`)
    console.log(`Key:     ${resolved}`)
    if (serviceAccount.project_id !== EXPECTED_PROJECT) {
        console.log(`WARNING: expected project ${EXPECTED_PROJECT}. Check the key before continuing.`)
    }
    if (dry) console.log('Mode:    DRY RUN - nothing will be written.')
    console.log('')

    const trainers = await db.collection('users').where('role', '==', 'trainer').get()

    // Grouped first, so a shared code is caught before either Trainer is written.
    const byCode = new Map()
    const noCode = []
    for (const row of trainers.docs) {
        const code = row.get('inviteCode')
        if (!code) {
            noCode.push(row)
            continue
        }
        if (!byCode.has(code)) byCode.set(code, [])
        byCode.get(code).push(row)
    }

    let written = 0
    let present = 0
    const problems = []

    for (const [code, rows] of byCode) {
        if (rows.length > 1) {
            problems.push(`code ${code} is on ${rows.length} Trainers: ${rows.map((r) => r.id).join(', ')}`)
            continue
        }
        const trainerId = rows[0].id
        const name = rows[0].get('name') || '(no name)'
        const ref = db.doc(`inviteCodes/${code}`)
        const existing = await ref.get()

        if (existing.exists) {
            if (existing.get('trainerId') === trainerId) {
                present++
                console.log(`  ok          inviteCodes/${code}  ${name}`)
            } else {
                problems.push(`inviteCodes/${code} points at ${existing.get('trainerId')}, but ${trainerId} (${name}) carries the code`)
            }
            continue
        }

        console.log(`  ${dry ? 'would write' : 'wrote     '} inviteCodes/${code}  ${name}`)
        if (!dry) await ref.create({ trainerId })
        written++
    }

    for (const row of noCode) {
        problems.push(`Trainer ${row.id} (${row.get('name') || 'no name'}) has no inviteCode, so no Client can register under them`)
    }

    console.log('')
    console.log(`${trainers.size} Trainer(s): ${written} ${dry ? 'to write' : 'written'}, ${present} already present, ${problems.length} problem(s).`)
    if (problems.length) {
        console.log('\nProblems (nothing was written for these):')
        problems.forEach((p) => console.log(`  - ${p}`))
        process.exit(1)
    }
}

main().catch((e) => {
    console.error('\nFATAL:', e.message)
    process.exit(1)
})
