#!/usr/bin/env node
/**
 * Seed the accounts and prescriptions needed to exercise the app by hand.
 *
 * Two trainers, three clients, four templates, five assignments, and no
 * sessions - a client's history stays empty on purpose, so the first session
 * anyone logs is one they can watch being written.
 *
 * Idempotent: auth users are looked up by email before being created, and every
 * document id is derived from a slug rather than minted, so a re-run updates in
 * place instead of duplicating.
 *
 *   node scripts/seed-test-data.js --dry     report, write nothing
 *   node scripts/seed-test-data.js           create or update
 *   node scripts/seed-test-data.js --reset   delete everything it created
 *
 * Deliberately plain .js under bare node, like every other script here.
 */

const fs = require('fs')
const path = require('path')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')

const REPO_ROOT = path.join(__dirname, '..')
const EXPECTED_PROJECT = 'gp-client-trainer-portal'
const PASSWORD = 'GreenPulse!2026'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const reset = args.includes('--reset')

// --- credentials (the same hand-parsed .env as every other script here) ----

const loadServiceAccount = () => {
    let configured = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!configured) {
        try {
            const env = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8')
            const line = env.split(/\r?\n/).find((l) => /^\s*GOOGLE_APPLICATION_CREDENTIALS\s*=/.test(l))
            if (line) configured = line.slice(line.indexOf('=') + 1).trim()
        } catch {}
    }
    if (!configured) {
        console.error('FATAL: GOOGLE_APPLICATION_CREDENTIALS is set neither in the environment nor in .env.')
        process.exit(1)
    }
    const resolved = path.isAbsolute(configured) ? configured : path.join(REPO_ROOT, configured)
    const raw = fs.readFileSync(resolved, 'utf8')
    if (!raw.trim()) {
        console.error(`FATAL: ${resolved} is empty.`)
        process.exit(1)
    }
    return JSON.parse(raw)
}

// --- the fixture ----------------------------------------------------------

// Real catalog ids with their declared fields. The plank carries duration only
// and the carry carries weight+distance, so the seeded data exercises the rule
// that an unused measurement is absent rather than zero.
const EX = {
    squat: { exerciseId: 'back-squat', name: 'Back Squat', fields: ['weightKg', 'reps'] },
    bench: { exerciseId: 'bb-bench-press', name: 'Barbell Bench Press', fields: ['weightKg', 'reps'] },
    rdl: { exerciseId: 'db-rdl', name: 'Dumbbell Romanian Deadlift', fields: ['weightKg', 'reps'] },
    deadlift: { exerciseId: 'conventional-deadlift', name: 'Conventional Deadlift', fields: ['weightKg', 'reps'] },
    ohp: { exerciseId: 'db-ohp', name: 'Dumbbell Overhead Press', fields: ['weightKg', 'reps'] },
    carry: { exerciseId: 'farmers-carry', name: 'Farmer’s Carry', fields: ['weightKg', 'distanceMeters'] },
    plank: { exerciseId: 'copenhagen-plank', name: 'Copenhagen Plank', fields: ['durationSeconds'] },
}

const sets = (ex, n, values) => ({ ...ex, sets: Array.from({ length: n }, () => ({ ...values })) })

const TRAINERS = [
    { key: 'zephyr', name: 'PT Zephyr', email: 'pt.zephyr@greenpulse.test', inviteCode: 'ZEPHYR' },
    { key: 'patrick', name: 'PT Patrick', email: 'pt.patrick@greenpulse.test', inviteCode: 'PATRK2' },
]

const CLIENTS = [
    { key: 'maya', name: 'Maya Adeyemi', email: 'maya@greenpulse.test', trainer: 'zephyr' },
    { key: 'tom', name: 'Tom Brennan', email: 'tom@greenpulse.test', trainer: 'patrick' },
    { key: 'priya', name: 'Priya Raman', email: 'priya@greenpulse.test', trainer: 'patrick' },
]

const TEMPLATES = [
    {
        key: 'lower-a', author: 'zephyr', name: 'Lower Body A',
        exercises: [
            sets(EX.squat, 3, { weightKg: 60, reps: 5 }),
            sets(EX.rdl, 3, { weightKg: 40, reps: 8 }),
            sets(EX.plank, 3, { durationSeconds: 45 }),
        ],
    },
    {
        key: 'upper-a', author: 'zephyr', name: 'Upper Body A',
        exercises: [
            sets(EX.bench, 4, { weightKg: 50, reps: 5 }),
            sets(EX.ohp, 3, { weightKg: 20, reps: 8 }),
        ],
    },
    {
        key: 'full-body', author: 'patrick', name: 'Full Body Strength',
        exercises: [
            sets(EX.deadlift, 3, { weightKg: 80, reps: 5 }),
            sets(EX.bench, 3, { weightKg: 55, reps: 5 }),
        ],
    },
    {
        // Zero loaded volume by design. The spec calls this case out: the verdict
        // is a set-by-set comparison and never a subtraction of totals, so a
        // workout of carries and planks must still compare correctly.
        key: 'conditioning', author: 'patrick', name: 'Conditioning',
        exercises: [
            sets(EX.carry, 3, { weightKg: 24, distanceMeters: 30 }),
            sets(EX.plank, 2, { durationSeconds: 60 }),
        ],
    },
]

// Deliberately partial. Tom is NOT on Conditioning, so there is a template his
// own trainer wrote that he must not be able to read - the negative case the
// smoke test needs, alongside the cross-trainer one.
const ASSIGNMENTS = [
    { template: 'lower-a', client: 'maya', timesPerWeek: 2 },
    { template: 'upper-a', client: 'maya', timesPerWeek: 2 },
    { template: 'full-body', client: 'tom', timesPerWeek: 3 },
    { template: 'full-body', client: 'priya', timesPerWeek: 2 },
    { template: 'conditioning', client: 'priya', timesPerWeek: 1 },
]

const templateId = (t) => `test-${t.author}-${t.key}`
const VERSION_ID = 'v1'

// --- run ------------------------------------------------------------------

const main = async () => {
    const serviceAccount = loadServiceAccount()
    initializeApp({ credential: cert(serviceAccount) })
    const db = getFirestore()
    const auth = getAuth()

    console.log(`Project: ${serviceAccount.project_id}`)
    // Fatal, not a warning. This script creates auth users and writes documents
    // at fixed ids, and --reset deletes both - so the one thing it must never do
    // is run against a project nobody meant to point it at. A warning scrolls
    // past in the same second the deletions start.
    //
    // Fatal in --dry too: a dry run against the wrong project reports "exists"
    // and "would create" about documents that are not the ones being reasoned
    // about, which is a worse answer than no answer.
    if (serviceAccount.project_id !== EXPECTED_PROJECT) {
        console.error(`FATAL: this key is for ${serviceAccount.project_id}, not ${EXPECTED_PROJECT}.`)
        console.error('Point GOOGLE_APPLICATION_CREDENTIALS at the right service account, or edit')
        console.error('EXPECTED_PROJECT above if you genuinely mean to seed somewhere else.')
        process.exit(1)
    }
    if (dry) console.log('Mode:    DRY RUN - nothing will be written.')
    console.log('')

    const uids = {}

    const ensureUser = async (person) => {
        let record = null
        try {
            record = await auth.getUserByEmail(person.email)
        } catch {}
        if (record) {
            uids[person.key] = record.uid
            console.log(`  exists       ${person.email.padEnd(30)} ${record.uid}`)
            return
        }
        if (dry) {
            uids[person.key] = `DRY-${person.key}`
            console.log(`  would create ${person.email}`)
            return
        }
        const created = await auth.createUser({
            email: person.email,
            password: PASSWORD,
            displayName: person.name,
            emailVerified: true,
        })
        uids[person.key] = created.uid
        console.log(`  created      ${person.email.padEnd(30)} ${created.uid}`)
    }

    console.log('Auth accounts...')
    for (const t of TRAINERS) await ensureUser(t)
    for (const c of CLIENTS) await ensureUser(c)

    if (reset) {
        console.log('\nReset: deleting seeded documents and accounts...')
        if (!dry) {
            for (const a of ASSIGNMENTS) {
                const t = TEMPLATES.find((x) => x.key === a.template)
                await db.doc(`assignments/${templateId(t)}_${uids[a.client]}`).delete()
            }
            for (const t of TEMPLATES) {
                await db.doc(`workoutTemplates/${templateId(t)}/versions/${VERSION_ID}`).delete()
                await db.doc(`workoutTemplates/${templateId(t)}`).delete()
            }
            for (const p of [...TRAINERS, ...CLIENTS]) {
                await db.doc(`users/${uids[p.key]}`).delete()
                await auth.deleteUser(uids[p.key]).catch(() => {})
            }
        }
        console.log('Reset complete.')
        return
    }

    console.log('\nProfiles...')
    for (const t of TRAINERS) {
        console.log(`  ${dry ? 'would write' : 'wrote     '} users/${uids[t.key]}  ${t.name} (trainer, invite ${t.inviteCode})`)
        if (dry) continue
        await db.doc(`users/${uids[t.key]}`).set({
            name: t.name, email: t.email, role: 'trainer',
            trainerId: null, inviteCode: t.inviteCode,
            createdAt: FieldValue.serverTimestamp(),
        }, { merge: true })
    }
    for (const c of CLIENTS) {
        console.log(`  ${dry ? 'would write' : 'wrote     '} users/${uids[c.key]}  ${c.name} (client of ${c.trainer})`)
        if (dry) continue
        await db.doc(`users/${uids[c.key]}`).set({
            name: c.name, email: c.email, role: 'client',
            trainerId: uids[c.trainer], inviteCode: null,
            createdAt: FieldValue.serverTimestamp(),
        }, { merge: true })
    }

    console.log('\nTemplates and their first Version...')
    for (const t of TEMPLATES) {
        const id = templateId(t)
        console.log(`  ${dry ? 'would write' : 'wrote     '} workoutTemplates/${id}  "${t.name}" by ${t.author}, ${t.exercises.length} exercises`)
        if (dry) continue
        // Parent first, then the version: the version-create rule resolves the
        // parent's author with get(), and rules cannot see a sibling write.
        await db.doc(`workoutTemplates/${id}`).set({
            name: t.name,
            authorId: uids[t.author],
            currentVersionId: VERSION_ID,
            currentVersionNumber: 1,
            currentVersionExerciseCount: t.exercises.length,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })
        await db.doc(`workoutTemplates/${id}/versions/${VERSION_ID}`).set({
            versionNumber: 1,
            exercises: t.exercises,
            createdAt: FieldValue.serverTimestamp(),
        }, { merge: true })
    }

    console.log('\nAssignments...')
    for (const a of ASSIGNMENTS) {
        const t = TEMPLATES.find((x) => x.key === a.template)
        const id = `${templateId(t)}_${uids[a.client]}`
        console.log(`  ${dry ? 'would write' : 'wrote     '} assignments/${id}`)
        console.log(`               ${a.client} -> "${t.name}", ${a.timesPerWeek}x/week`)
        if (dry) continue
        await db.doc(`assignments/${id}`).set({
            templateId: templateId(t),
            clientId: uids[a.client],
            trainerId: uids[t.author],
            timesPerWeek: a.timesPerWeek,
            active: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })
    }

    console.log('\nUIDs:')
    Object.entries(uids).forEach(([k, v]) => console.log(`  ${k.padEnd(9)} ${v}`))
    console.log(`\nPassword for every seeded account: ${PASSWORD}`)
    console.log(dry ? '\nDry run complete. Nothing was written.' : '\nSeed complete. No sessions were created, by design.')
}

main().catch((e) => {
    console.error('FAILED:', e.message)
    process.exit(1)
})
