#!/usr/bin/env node
/**
 * Seed the accounts and prescriptions needed to exercise the app by hand.
 *
 * Two cohorts, kept apart on purpose.
 *
 * **The fixture** - two trainers, three clients, four templates, five
 * assignments, and no sessions. A client's history stays empty on purpose, so
 * the first session anyone logs is one they can watch being written. Throwaway:
 * the password is shared, weak and committed so anyone can pick the fixture up.
 *
 * **The review accounts** (`--review`) - one trainer and one client per store,
 * for Apple's and Google's app reviewers. These are not throwaway. Their
 * passwords never enter git, and they are seeded with assigned work and finished
 * sessions, because a reviewer who signs in to empty lists cannot evaluate the
 * app and files a rejection instead. See docs/store-listing.md.
 *
 * The two cohorts share every code path here but no data, and `--reset` only
 * ever deletes the cohort you asked for. That separation is the whole point:
 * `--reset` on the fixture must not be able to cut off a live app review.
 *
 * Idempotent: auth users are looked up by email before being created, and every
 * document id is derived from a slug rather than minted, so a re-run updates in
 * place instead of duplicating.
 *
 *   node scripts/seed-test-data.js --dry              report, write nothing
 *   node scripts/seed-test-data.js                    create or update the fixture
 *   node scripts/seed-test-data.js --reset            delete the fixture
 *   node scripts/seed-test-data.js --review           create or update the review accounts
 *   node scripts/seed-test-data.js --review --rotate  ... and mint new passwords
 *   node scripts/seed-test-data.js --review --reset   delete the review accounts
 *
 * Deliberately plain .js under bare node, like every other script here.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')

const REPO_ROOT = path.join(__dirname, '..')
const EXPECTED_PROJECT = 'gp-client-trainer-portal'
const PASSWORD = 'Green1!'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const reset = args.includes('--reset')
const review = args.includes('--review')
const rotate = args.includes('--rotate')

// --- credentials (the same hand-parsed .env as every other script here) ----

// No dotenv: these scripts run under bare node with no build step, so .env is
// read the same way in all of them. Kept as one lookup rather than three copies
// now that the review passwords come from there too.
let envText = null
const envValue = (key) => {
    if (process.env[key]) return process.env[key]
    if (envText === null) {
        try {
            envText = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8')
        } catch {
            envText = ''
        }
    }
    const line = envText.split(/\r?\n/).find((l) => new RegExp(`^\\s*${key}\\s*=`).test(l))
    return line ? line.slice(line.indexOf('=') + 1).trim() : ''
}

const loadServiceAccount = () => {
    const configured = envValue('GOOGLE_APPLICATION_CREDENTIALS')
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
    { key: 'zephyr', name: 'PT Zephyr', email: 'pt.zephyr@greenpulse.fit', inviteCode: 'ZEPHYR' },
    { key: 'patrick', name: 'PT Patrick', email: 'pt.patrick@greenpulse.fit', inviteCode: 'PATRK2' },
]

const CLIENTS = [
    { key: 'maya', name: 'Maya Adeyemi', email: 'maya@greenpulse.fit', trainer: 'zephyr' },
    { key: 'tom', name: 'Tom Brennan', email: 'tom@greenpulse.fit', trainer: 'patrick' },
    { key: 'priya', name: 'Priya Raman', email: 'priya@greenpulse.fit', trainer: 'patrick' },
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

// The prefix says which cohort a document belongs to, at a glance in the
// Firestore console and in every --reset loop below. Nothing derives meaning
// from it beyond that; it exists so a review document can never be mistaken for
// a throwaway one.
const templateId = (t) => `${t.prefix ?? 'test'}-${t.author}-${t.key}`
const VERSION_ID = 'v1'

// --- the review cohort ----------------------------------------------------

/**
 * One trainer and one client per store, so Apple's reviewer and Google's never
 * share an account.
 *
 * That is not tidiness. The single-active-Session rule is enforced by the UI and
 * not by Firestore (ADR 0003), so two reviewers signed into one Client account
 * at the same time - which is exactly what concurrent submissions produce - see
 * each other's open Session and are told they already have a workout in
 * progress. It reads as a bug in the app, and it is the reviewer who writes it
 * up.
 *
 * Emails sit under `review.greenpulse.fit` rather than the fixture's
 * `greenpulse.fit`, which makes the cohort greppable in the Auth console.
 */
const REVIEW_STORES = [
    {
        key: 'apple',
        store: 'Apple App Review',
        passwordKey: 'REVIEW_PASSWORD_APPLE',
        trainer: {
            key: 'apple-pt', name: 'PT Alex Rivera',
            email: 'apple.trainer@review.greenpulse.fit', inviteCode: 'APLREV',
        },
        client: {
            key: 'apple-client', name: 'Jordan Lee',
            email: 'apple.client@review.greenpulse.fit', trainer: 'apple-pt',
        },
    },
    {
        key: 'google',
        store: 'Google Play review',
        passwordKey: 'REVIEW_PASSWORD_GOOGLE',
        trainer: {
            key: 'google-pt', name: 'PT Sam Okafor',
            email: 'google.trainer@review.greenpulse.fit', inviteCode: 'GOOREV',
        },
        client: {
            key: 'google-client', name: 'Riley Chen',
            email: 'google.client@review.greenpulse.fit', trainer: 'google-pt',
        },
    },
]

const REVIEW_TRAINERS = REVIEW_STORES.map((s) => s.trainer)
const REVIEW_CLIENTS = REVIEW_STORES.map((s) => s.client)

// Two templates each, not one: a Library with a single row does not show a
// reviewer that templates are a list, and the second one carries the plank, so
// the diff a reviewer opens has an exercise measured in seconds rather than
// four rows of the same two numbers.
const REVIEW_TEMPLATES = REVIEW_STORES.flatMap((s) => [
    {
        prefix: 'review', key: 'full-body', author: s.trainer.key, name: 'Full Body Strength',
        exercises: [
            sets(EX.deadlift, 3, { weightKg: 80, reps: 5 }),
            sets(EX.bench, 3, { weightKg: 55, reps: 5 }),
        ],
    },
    {
        prefix: 'review', key: 'lower-a', author: s.trainer.key, name: 'Lower Body A',
        exercises: [
            sets(EX.squat, 3, { weightKg: 60, reps: 5 }),
            sets(EX.rdl, 3, { weightKg: 40, reps: 8 }),
            sets(EX.plank, 3, { durationSeconds: 45 }),
        ],
    },
])

const REVIEW_ASSIGNMENTS = REVIEW_STORES.flatMap((s) => [
    { template: 'full-body', author: s.trainer.key, client: s.client.key, timesPerWeek: 2 },
    { template: 'lower-a', author: s.trainer.key, client: s.client.key, timesPerWeek: 1 },
])

/**
 * Two finished Sessions per review client, one of each verdict.
 *
 * One of each because the verdict is the thing worth looking at and *As
 * Prescribed* alone does not show what Modified means. Dated within the trailing
 * seven days so the Trainer's weekly completion card has real numbers in it
 * rather than "0 of 3" - the dates are relative to the run, so re-seeding before
 * a submission refreshes them.
 *
 * No `startedAt` or `completedAt`, matching `createManualSession`: these were
 * not timed, and those two fields bracket a stopwatch that never ran.
 */
const REVIEW_SESSIONS = REVIEW_STORES.flatMap((s) => [
    {
        id: `review-${s.key}-session-1`, client: s.client.key,
        template: 'full-body', author: s.trainer.key,
        daysAgo: 5, durationSeconds: 3120,
        notes: 'Felt strong, bar moved fast.',
        // Performed exactly as prescribed, so the verdict comes out As Prescribed.
        deviations: {},
    },
    {
        id: `review-${s.key}-session-2`, client: s.client.key,
        template: 'lower-a', author: s.trainer.key,
        daysAgo: 2, durationSeconds: 2760,
        notes: 'Knee felt tight on the last squat set, cut it short and left the plank.',
        // One set short on one exercise, and one exercise not done at all - the
        // two deviations that read differently in the diff ("changed" against
        // "skipped"), which is the distinction ADR 0005 exists to draw.
        deviations: {
            change: { exerciseId: 'back-squat', setIndex: 2, values: { reps: 3 } },
            skip: ['copenhagen-plank'],
        },
    },
])

/**
 * What the Client actually did, built from what they were asked to do.
 *
 * The review assignments carry no per-client overrides, so the targets a Client
 * sees are the Version's own Exercises (ADR 0004) and this can start from them.
 * An Exercise named in `skip` is dropped entirely rather than stored with no
 * Sets, because that is what the live screen does: a row with nothing ticked is
 * never written.
 */
const performedFrom = (targets, deviations) =>
    targets
        .filter((ex) => !(deviations.skip ?? []).includes(ex.exerciseId))
        .map((ex) => ({
            ...ex,
            sets: ex.sets.map((set, i) =>
                deviations.change &&
                deviations.change.exerciseId === ex.exerciseId &&
                deviations.change.setIndex === i
                    ? { ...set, ...deviations.change.values }
                    : { ...set }
            ),
        }))

/**
 * The verdict and its diff, computed the way the app computes them.
 *
 * A deliberate, narrow duplicate of `compareSession` in `utils/prescription.ts`:
 * this script is plain `.js` under bare node with no build step, so it cannot
 * import the TypeScript module the app uses. Kept to the same pairing rules -
 * Exercises by id, Sets by position, a measurement compared as null rather than
 * 0 when absent - because a seeded Session whose stored diff disagreed with what
 * the app would have written is worse than no seeded Session at all.
 *
 * **If ADR 0005 or `compareSession` changes, change this too.**
 */
const compareLikeTheApp = (performed, targets) => {
    const unpaired = [...performed]
    const measurement = (set, field) => (set && set[field] != null ? set[field] : null)
    const project = (set, fields) =>
        fields.reduce((acc, field) => ({ ...acc, [field]: measurement(set, field) }), {})

    const exercises = targets.map((target) => {
        const at = unpaired.findIndex((ex) => ex.exerciseId === target.exerciseId)
        const done = at === -1 ? null : unpaired.splice(at, 1)[0]
        const fields = [
            ...target.fields,
            ...((done && done.fields) || []).filter((f) => !target.fields.includes(f)),
        ]
        const want = target.sets ?? []
        const got = (done && done.sets) || []

        const setDiffs = Array.from({ length: Math.max(want.length, got.length) }, (_, i) => {
            if (!want[i]) {
                return { set: i + 1, status: 'added', target: null, performed: project(got[i], fields), changed: [] }
            }
            if (!got[i]) {
                return { set: i + 1, status: 'skipped', target: project(want[i], fields), performed: null, changed: [] }
            }
            const changed = fields.filter((f) => measurement(got[i], f) !== measurement(want[i], f))
            return {
                set: i + 1,
                status: changed.length > 0 ? 'changed' : 'matched',
                target: project(want[i], fields),
                performed: project(got[i], fields),
                changed,
            }
        })

        return {
            exerciseId: target.exerciseId,
            name: target.name,
            fields,
            status:
                setDiffs.length === 0
                    ? 'matched'
                    : !done || got.length === 0
                      ? 'skipped'
                      : setDiffs.every((s) => s.status === 'matched')
                        ? 'matched'
                        : 'changed',
            sets: setDiffs,
        }
    })

    return {
        verdict: exercises.every((ex) => ex.status === 'matched') ? 'as-prescribed' : 'modified',
        exercises,
    }
}

// --- which cohort this run is about ---------------------------------------

// One shape, two datasets. Every loop in main() reads from here, so the review
// cohort cannot drift into a second copy of the seeding logic - and the fixture
// keeps its empty session list, which is the deliberate "no sessions exist for
// these five accounts" the docs promise.
const COHORT = review
    ? {
          label: 'review accounts',
          trainers: REVIEW_TRAINERS,
          clients: REVIEW_CLIENTS,
          templates: REVIEW_TEMPLATES,
          assignments: REVIEW_ASSIGNMENTS,
          sessions: REVIEW_SESSIONS,
      }
    : {
          label: 'test fixture',
          trainers: TRAINERS,
          clients: CLIENTS,
          templates: TEMPLATES,
          assignments: ASSIGNMENTS,
          sessions: [],
      }

const findTemplate = (a) =>
    COHORT.templates.find((t) => t.key === a.template && (!a.author || t.author === a.author))

// --- review passwords ------------------------------------------------------

/**
 * The review password for one store: from the environment if it is there, minted
 * if it is not.
 *
 * Never a literal in this file. The fixture password is committed on purpose so
 * anyone can pick the fixture up; these accounts are the opposite - they are
 * handed to two outside reviewers and live alongside real beta users, so the
 * only copies are the two store consoles and (optionally) the gitignored .env.
 *
 * A minted password is printed once, at the end of the run, and is not
 * recoverable afterwards - Firebase stores a hash, and this script cannot read
 * one back. That is why an account that already exists keeps the password it
 * has unless `--rotate` is passed: silently rotating on every re-seed would
 * invalidate credentials already pasted into a live submission.
 */
const mintPassword = () => `Rev-${crypto.randomBytes(12).toString('base64url')}`

const reviewPasswords = Object.fromEntries(
    REVIEW_STORES.map((s) => [s.key, { configured: Boolean(envValue(s.passwordKey)), value: envValue(s.passwordKey) || mintPassword() }])
)

// One password per store, shared by that store's trainer and client. The
// separation that matters is between the two reviewers, not between the two
// roles one reviewer is asked to sign into.
const passwordFor = (person) => {
    if (!review) return PASSWORD
    const store = REVIEW_STORES.find((s) => s.trainer.key === person.key || s.client.key === person.key)
    return reviewPasswords[store.key].value
}

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
    console.log(`Cohort:  ${COHORT.label}`)
    if (dry) console.log('Mode:    DRY RUN - nothing will be written.')
    console.log('')

    const uids = {}
    // What happens to each store's password this run, so the report at the end
    // tells the truth rather than printing a value that was never set.
    const passwordState = {}

    /**
     * Decide each review store's password regime before touching any account.
     *
     * A store's trainer and client share one password, so the decision belongs
     * to the pair. Creating one account with a fresh password while the other
     * kept an older one would hand the reviewer a credential that signs in as
     * the trainer and fails as the client - which reads as a broken app.
     *
     *   created    neither existed; both get this run's password
     *   rotated    --rotate; both are set to this run's password
     *   resynced   exactly one existed, so the pair was out of step; both are set
     *   unchanged  both existed and keep whatever they already have
     */
    const planReviewPasswords = async () => {
        for (const s of REVIEW_STORES) {
            let present = 0
            for (const p of [s.trainer, s.client]) {
                try {
                    await auth.getUserByEmail(p.email)
                    present += 1
                } catch {}
            }
            passwordState[s.key] =
                present === 0 ? 'created' : rotate ? 'rotated' : present === 1 ? 'resynced' : 'unchanged'
        }
    }

    const ensureUser = async (person) => {
        const password = passwordFor(person)
        const store = REVIEW_STORES.find((s) => s.trainer.key === person.key || s.client.key === person.key)
        // The fixture password is fixed and committed, so a fixture account that
        // already exists never needs writing. A review account is rewritten only
        // when its store's regime says so.
        const setPassword = Boolean(store) && passwordState[store.key] !== 'unchanged'
        let record = null
        try {
            record = await auth.getUserByEmail(person.email)
        } catch {}
        if (record) {
            uids[person.key] = record.uid
            if (setPassword && !dry) await auth.updateUser(record.uid, { password })
            console.log(`  exists       ${person.email.padEnd(38)} ${record.uid}${setPassword ? '  (password set)' : ''}`)
            return
        }
        // Nothing to create when the point of the run is to delete: a reset
        // used to mint the whole cohort seconds before removing it again, which
        // left a log that read as though it had seeded and a trail of accounts
        // in the Auth console's audit. Absent is the outcome a reset wants, so
        // the deletes below skip a person with no uid.
        if (reset) {
            console.log(`  absent       ${person.email}`)
            return
        }
        if (dry) {
            uids[person.key] = `DRY-${person.key}`
            console.log(`  would create ${person.email}`)
            return
        }
        const created = await auth.createUser({
            email: person.email,
            password,
            displayName: person.name,
            emailVerified: true,
        })
        uids[person.key] = created.uid
        console.log(`  created      ${person.email.padEnd(38)} ${created.uid}`)
    }

    console.log('Auth accounts...')
    if (review) await planReviewPasswords()
    for (const t of COHORT.trainers) await ensureUser(t)
    for (const c of COHORT.clients) await ensureUser(c)

    if (reset) {
        console.log(`\nReset: deleting the ${COHORT.label} - documents and accounts...`)
        if (!dry) {
            // Sessions first: they are the only documents here that cite three
            // others, so deleting them last would leave a window where a review
            // client's history pointed at a template that had gone.
            for (const s of COHORT.sessions) await db.doc(`sessions/${s.id}`).delete()
            for (const a of COHORT.assignments) {
                // An Assignment's id is derived from the Client's uid, so an
                // absent Client leaves nothing to address - and an id built
                // from `undefined` would name a document that never existed.
                if (!uids[a.client]) continue
                const t = findTemplate(a)
                await db.doc(`assignments/${templateId(t)}_${uids[a.client]}`).delete()
            }
            for (const t of COHORT.templates) {
                await db.doc(`workoutTemplates/${templateId(t)}/versions/${VERSION_ID}`).delete()
                await db.doc(`workoutTemplates/${templateId(t)}`).delete()
            }
            for (const t of COHORT.trainers) {
                await db.doc(`inviteCodes/${t.inviteCode}`).delete()
            }
            for (const p of [...COHORT.trainers, ...COHORT.clients]) {
                if (!uids[p.key]) continue
                await db.doc(`users/${uids[p.key]}`).delete()
                await auth.deleteUser(uids[p.key]).catch(() => {})
            }
        }
        console.log('Reset complete.')
        if (!review) console.log('The review accounts were not touched. Use --review --reset for those.')
        return
    }

    console.log('\nProfiles...')
    for (const t of COHORT.trainers) {
        console.log(`  ${dry ? 'would write' : 'wrote     '} users/${uids[t.key]}  ${t.name} (trainer, invite ${t.inviteCode})`)
        if (dry) continue
        await db.doc(`users/${uids[t.key]}`).set({
            name: t.name, email: t.email, role: 'trainer',
            trainerId: null, inviteCode: t.inviteCode,
            createdAt: FieldValue.serverTimestamp(),
        }, { merge: true })
        // The lookup Client registration actually reads (see firestore.rules,
        // inviteCodes/). Without it the code on the profile is decoration.
        await db.doc(`inviteCodes/${t.inviteCode}`).set({ trainerId: uids[t.key] })
    }
    for (const c of COHORT.clients) {
        console.log(`  ${dry ? 'would write' : 'wrote     '} users/${uids[c.key]}  ${c.name} (client of ${c.trainer})`)
        if (dry) continue
        await db.doc(`users/${uids[c.key]}`).set({
            name: c.name, email: c.email, role: 'client',
            trainerId: uids[c.trainer], inviteCode: null,
            createdAt: FieldValue.serverTimestamp(),
        }, { merge: true })
    }

    console.log('\nTemplates and their first Version...')
    for (const t of COHORT.templates) {
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
    for (const a of COHORT.assignments) {
        const t = findTemplate(a)
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

    // Empty for the fixture, on purpose: a client's history stays blank so the
    // first session anyone logs is one they can watch being written. Only the
    // review cohort ships with history, because a reviewer has no time to build
    // some before deciding whether the app does anything.
    if (COHORT.sessions.length) {
        console.log('\nSessions...')
        for (const s of COHORT.sessions) {
            const t = findTemplate(s)
            // No per-client overrides on these Assignments, so the targets are
            // the Version's own Exercises (ADR 0004) and the comparison is
            // against exactly what the Client was shown.
            const targets = t.exercises
            const exercises = performedFrom(targets, s.deviations)
            const comparison = compareLikeTheApp(exercises, targets)
            const date = new Date(Date.now() - s.daysAgo * 24 * 60 * 60 * 1000)
            console.log(`  ${dry ? 'would write' : 'wrote     '} sessions/${s.id}`)
            console.log(`               ${s.client} -> "${t.name}", ${s.daysAgo}d ago, ${comparison.verdict}`)
            if (dry) continue
            await db.doc(`sessions/${s.id}`).set({
                clientId: uids[s.client],
                status: 'completed',
                date: Timestamp.fromDate(date),
                exercises,
                durationSeconds: s.durationSeconds,
                // Derived here in one line rather than typed twice, so the two
                // can never disagree - see completeSession in hooks/useSessions.
                durationMinutes: Math.round(s.durationSeconds / 60),
                notes: s.notes,
                templateId: templateId(t),
                versionId: VERSION_ID,
                templateName: t.name,
                verdict: comparison.verdict,
                diff: comparison.exercises,
                createdAt: FieldValue.serverTimestamp(),
            }, { merge: true })
        }
    }

    console.log('\nUIDs:')
    Object.entries(uids).forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ${v}`))

    if (!review) {
        console.log(`\nPassword for every seeded account: ${PASSWORD}`)
        console.log(dry ? '\nDry run complete. Nothing was written.' : '\nSeed complete. No sessions were created, by design.')
        return
    }

    // A dry run mints a password so it can report what a real run would do, but
    // nothing was set - saying otherwise would send someone to paste a value into
    // a store console that no account actually has.
    console.log(dry ? '\nPasswords a real run would set:' : '\nPasswords - copy these into the store consoles now:')
    for (const s of REVIEW_STORES) {
        const state = passwordState[s.key] ?? 'unchanged'
        const source = reviewPasswords[s.key].configured ? `from ${s.passwordKey}` : 'minted by this run'
        console.log(`\n  ${s.store}`)
        console.log(`    trainer  ${s.trainer.email}   (invite code ${s.trainer.inviteCode})`)
        console.log(`    client   ${s.client.email}`)
        if (state === 'unchanged') {
            console.log('    password unchanged - both accounts already existed and keep what they have.')
            console.log(`    Set ${s.passwordKey} in .env, or pass --rotate, if the old one is lost.`)
            continue
        }
        console.log(`    password ${reviewPasswords[s.key].value}   (${state}, ${source})`)
    }
    if (!dry) {
        console.log('\nA minted password is shown here and nowhere else - Firebase keeps only a hash,')
        console.log('so it cannot be read back. Paste it into the store console before closing this.')
    }
    console.log(dry ? '\nDry run complete. Nothing was written.' : '\nReview accounts seeded. See docs/store-listing.md for the review notes.')
}

main().catch((e) => {
    console.error('FAILED:', e.message)
    process.exit(1)
})
