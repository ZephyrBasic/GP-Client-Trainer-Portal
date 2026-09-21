#!/usr/bin/env node
/**
 * Exercise firestore.rules as real signed-in users.
 *
 * This deliberately uses the **client** SDK, not the Admin SDK. Admin bypasses
 * rules entirely, so it can seed data but can never test authorization; the only
 * honest check is to sign in as each account and see what Firestore actually
 * allows. Requires scripts/seed-test-data.js to have run.
 *
 *   node scripts/smoke-test-rules.js
 *
 * Exits non-zero if any expectation fails, so it can gate a commit.
 * Reads EXPO_PUBLIC_FIREBASE_* from .env by hand, like the other scripts.
 *
 * A full pass is currently **45 passed, 0 failed**. Any other number means a
 * rule moved or an assertion was added without updating this line and the
 * matching one in CLAUDE.md.
 */

const fs = require('fs')
const path = require('path')
const { initializeApp } = require('firebase/app')
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth')
const {
    getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, deleteField,
    collection, query, where, getDocs,
} = require('firebase/firestore')

const REPO_ROOT = path.join(__dirname, '..')
const PASSWORD = 'Green1!'

// --- config ---------------------------------------------------------------

const env = {}
try {
    fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8')
        .split(/\r?\n/)
        .forEach((line) => {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
            if (m) env[m[1]] = m[2].trim()
        })
} catch {}

const cfg = (k) => process.env[k] || env[k]
const firebaseConfig = {
    apiKey: cfg('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: cfg('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: cfg('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: cfg('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: cfg('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: cfg('EXPO_PUBLIC_FIREBASE_APP_ID'),
}
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('FATAL: EXPO_PUBLIC_FIREBASE_* not found in the environment or .env.')
    process.exit(1)
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

// --- accounts and fixture ids ---------------------------------------------

const EMAIL = {
    zephyr: 'pt.zephyr@greenpulse.test',
    patrick: 'pt.patrick@greenpulse.test',
    maya: 'maya@greenpulse.test',
    tom: 'tom@greenpulse.test',
    priya: 'priya@greenpulse.test',
}

const T = {
    lowerA: 'test-zephyr-lower-a',
    upperA: 'test-zephyr-upper-a',
    fullBody: 'test-patrick-full-body',
    conditioning: 'test-patrick-conditioning',
}

const uid = {}

// --- harness --------------------------------------------------------------

let passed = 0
const failures = []

const isDenied = (e) =>
    e && (e.code === 'permission-denied' || /insufficient permissions|PERMISSION_DENIED/i.test(e.message || ''))

/**
 * `expect` names what should happen and why it matters, so a failure reads as a
 * broken guarantee rather than a broken line number.
 */
const expect = async (label, mode, fn) => {
    try {
        await fn()
        if (mode === 'allow') {
            passed++
            console.log(`  PASS  allow  ${label}`)
        } else {
            failures.push(`${label} - was ALLOWED but must be denied`)
            console.log(`  FAIL  DENY?  ${label}  <-- allowed, expected denial`)
        }
    } catch (e) {
        if (mode === 'deny' && isDenied(e)) {
            passed++
            console.log(`  PASS  deny   ${label}`)
        } else if (mode === 'deny') {
            failures.push(`${label} - failed, but not with permission-denied: ${e.message}`)
            console.log(`  FAIL  deny   ${label}  <-- wrong error: ${e.message}`)
        } else {
            failures.push(`${label} - was DENIED but must be allowed: ${e.message}`)
            console.log(`  FAIL  ALLOW? ${label}  <-- denied: ${e.message}`)
        }
    }
}

/**
 * Puts the one document this script mutates back the way seed-test-data.js
 * writes it.
 *
 * `targetOverrides` is removed rather than set to `{}`: the seed writes no such
 * field at all, and "restored" has to mean the document the next run expects
 * rather than one that merely behaves the same today.
 *
 * A failed restore is reported rather than swallowed. It leaves a fixture that
 * no longer says what the rest of this file assumes, and learning that from a
 * confusing failure two runs later is worse than being told now.
 */
const restoreFixture = async () => {
    const path = `assignments/${T.lowerA}_${uid.maya}`
    try {
        await updateDoc(doc(db, 'assignments', `${T.lowerA}_${uid.maya}`), {
            timesPerWeek: 2,
            active: true,
            targetOverrides: deleteField(),
        })
    } catch (e) {
        failures.push(`fixture restore failed - ${path} is left altered: ${e.message}`)
        console.log(`  FAIL  restore ${path}  <-- ${e.message}`)
    }
}

const as = async (who) => {
    await signOut(auth).catch(() => {})
    const cred = await signInWithEmailAndPassword(auth, EMAIL[who], PASSWORD)
    uid[who] = cred.user.uid
    console.log(`\n--- signed in as ${who} (${EMAIL[who]}) ---`)
}

// --- the matrix -----------------------------------------------------------

const main = async () => {
    console.log(`Project: ${firebaseConfig.projectId}`)
    console.log('Exercising firestore.rules as real users via the client SDK.\n')

    // Collect uids first; several assertions need another user's id.
    for (const who of Object.keys(EMAIL)) {
        const cred = await signInWithEmailAndPassword(auth, EMAIL[who], PASSWORD)
        uid[who] = cred.user.uid
        await signOut(auth)
    }

    // === Maya: Zephyr's client, assigned Lower Body A and Upper Body A =====
    await as('maya')

    // THE critical one. This is the exists() clause on workoutTemplates that
    // concatenates templateId + '_' + uid. If it silently evaluates false,
    // every assigned client loses access to their prescribed workout.
    await expect('assigned client reads her prescribed Template', 'allow', () =>
        getDoc(doc(db, 'workoutTemplates', T.lowerA)).then((s) => {
            if (!s.exists()) throw new Error('document missing')
        }))

    await expect('assigned client reads that Template\'s Version', 'allow', () =>
        getDoc(doc(db, 'workoutTemplates', T.lowerA, 'versions', 'v1')).then((s) => {
            if (!s.exists()) throw new Error('version missing')
        }))

    await expect('client reads her own Assignments', 'allow', () =>
        getDocs(query(collection(db, 'assignments'), where('clientId', '==', uid.maya))))

    // The core client action, and the one the whole app exists for. Mirrors
    // startSession/completeSession/discardSession in hooks/useSessions.ts:
    // create, update, delete, all by the owning client. Creating and then
    // deleting leaves the fixture as it was, which matters because the seeded
    // clients are meant to start with no history.
    let ownSessionId = null
    await expect('client creates her own Session', 'allow', async () => {
        const ref = await addDoc(collection(db, 'sessions'), {
            clientId: uid.maya, status: 'active', exercises: [],
            templateId: T.lowerA, versionId: 'v1', templateName: 'Lower Body A',
        })
        ownSessionId = ref.id
    })

    await expect('client completes her own Session', 'allow', () =>
        updateDoc(doc(db, 'sessions', ownSessionId), { status: 'completed', durationMinutes: 42 }))

    await expect('client reads her own Sessions', 'allow', () =>
        getDocs(query(collection(db, 'sessions'), where('clientId', '==', uid.maya))))

    await expect('client discards her own Session', 'allow', () =>
        deleteDoc(doc(db, 'sessions', ownSessionId)))

    await expect('client reads another trainer\'s Template', 'deny', () =>
        getDoc(doc(db, 'workoutTemplates', T.fullBody)).then((s) => {
            if (!s.exists()) throw new Error('missing, not denied')
        }))

    await expect('client creates an Assignment for herself', 'deny', () =>
        setDoc(doc(db, 'assignments', `${T.fullBody}_${uid.maya}`), {
            templateId: T.fullBody, clientId: uid.maya, trainerId: uid.maya,
            timesPerWeek: 3, active: true,
        }))

    await expect('client deactivates her own Assignment', 'deny', () =>
        updateDoc(doc(db, 'assignments', `${T.lowerA}_${uid.maya}`), { active: false }))

    await expect('client promotes herself to trainer', 'deny', () =>
        updateDoc(doc(db, 'users', uid.maya), { role: 'trainer' }))

    await expect('client re-links to a different trainer', 'deny', () =>
        updateDoc(doc(db, 'users', uid.maya), { trainerId: uid.patrick }))

    await expect('client edits a Template she is assigned', 'deny', () =>
        updateDoc(doc(db, 'workoutTemplates', T.lowerA), { name: 'Hijacked' }))

    // === The trainer signup gate ==========================================
    //
    // The gate's whole security argument is an asymmetry: rules' get() can read
    // the shared code and the applicant's answer, and no client can read either.
    // If any of these four denials turns into an allow, the first curious tester
    // can read the code out of Firestore and hand out trainer accounts - which
    // is exactly the thing the gate exists to prevent, and it would fail
    // silently, because the app would carry on working.
    await expect('client reads the shared trainer signup code', 'deny', () =>
        getDoc(doc(db, 'config', 'trainerSignup')).then((s) => {
            if (!s.exists()) throw new Error('missing, not denied')
        }))

    await expect('client reads another user\'s signup proof', 'deny', () =>
        getDoc(doc(db, 'users', uid.zephyr, 'private', 'signup')).then((s) => {
            if (!s.exists()) throw new Error('missing, not denied')
        }))

    // Mutating, so fenced: the proof document has to go whatever happens in
    // between, or the next run finds Maya carrying a stale one.
    try {
        await expect('client writes her own signup proof', 'allow', () =>
            setDoc(doc(db, 'users', uid.maya, 'private', 'signup'), { trainerCode: 'not-the-code' }))

        // The one that matters most. `users` is world-readable to signed-in
        // accounts, and this subcollection is only private because rules v2 does
        // not extend a document match to the paths beneath it. A rules_version
        // downgrade, or a stray `match /users/{uid}/{doc=**}`, would quietly undo
        // that and put the applicant's own answer - and by extension the shared
        // code - back within reach.
        await expect('client reads the signup proof she just wrote', 'deny', () =>
            getDoc(doc(db, 'users', uid.maya, 'private', 'signup')).then((s) => {
                if (!s.exists()) throw new Error('missing, not denied')
            }))
    } finally {
        await expect('client deletes her own signup proof', 'allow', () =>
            deleteDoc(doc(db, 'users', uid.maya, 'private', 'signup')))
    }

    // Account deletion, from the side that can be asserted without destroying
    // the fixture. The matching allow - a user deleting their *own* profile -
    // has no non-destructive form here: it would delete a seeded account and
    // every later assertion with it, so it is verified by hand against a
    // throwaway registration instead.
    await expect('client deletes another user\'s account document', 'deny', () =>
        deleteDoc(doc(db, 'users', uid.tom)))

    // === Tom: Patrick's client, assigned Full Body only ===================
    await as('tom')

    await expect('assigned client reads his prescribed Template', 'allow', () =>
        getDoc(doc(db, 'workoutTemplates', T.fullBody)).then((s) => {
            if (!s.exists()) throw new Error('document missing')
        }))

    // His own trainer wrote this one, but he is not assigned to it. Authorship
    // grants nothing to a client; only an Assignment does.
    await expect('client reads his own trainer\'s UNassigned Template', 'deny', () =>
        getDoc(doc(db, 'workoutTemplates', T.conditioning)).then((s) => {
            if (!s.exists()) throw new Error('missing, not denied')
        }))

    await expect('client reads another client\'s Assignment', 'deny', () =>
        getDoc(doc(db, 'assignments', `${T.lowerA}_${uid.maya}`)).then((s) => {
            if (!s.exists()) throw new Error('missing, not denied')
        }))

    // === Zephyr: trainer =================================================
    await as('zephyr')

    await expect('trainer reads his own Template', 'allow', () =>
        getDoc(doc(db, 'workoutTemplates', T.lowerA)).then((s) => {
            if (!s.exists()) throw new Error('document missing')
        }))

    await expect('trainer lists his own Templates', 'allow', () =>
        getDocs(query(collection(db, 'workoutTemplates'), where('authorId', '==', uid.zephyr))))

    // These two mirror useClients and useTrainerAssignments exactly, filters and
    // all. Both are reads the trainer's screens depend on, and neither was
    // covered - a query the rules reject, or one that turns out to want a
    // composite index, would break the roster with nothing here to catch it.
    await expect('trainer lists his own Clients', 'allow', () =>
        getDocs(query(
            collection(db, 'users'),
            where('trainerId', '==', uid.zephyr),
            where('role', '==', 'client')
        )))

    await expect('trainer lists Assignments he owns', 'allow', () =>
        getDocs(query(collection(db, 'assignments'), where('trainerId', '==', uid.zephyr))))

    await expect('trainer reads his client\'s Sessions', 'allow', () =>
        getDocs(query(collection(db, 'sessions'), where('clientId', '==', uid.maya))))

    // The writes the assign screen actually makes. Ticket 08 added an
    // overridesWellFormed() clause to assignments create/update, so these guard
    // against tightening the rule into a shape the app can no longer satisfy -
    // a regression that would otherwise surface as a silent permission error
    // mid-demo.
    //
    // These four are the only assertions in this file that leave a document
    // changed, so they are fenced: the restore runs however the block exits - a
    // failed expectation, a thrown sign-in, a dropped connection. Unfenced, a
    // throw part-way through leaves Maya's Assignment carrying an override, and
    // that silently changes both what the next run of this script sees and what
    // the manual app pass beside it is looking at.
    try {
        await expect('trainer changes a Target Frequency on his own Assignment', 'allow', () =>
            updateDoc(doc(db, 'assignments', `${T.lowerA}_${uid.maya}`), { timesPerWeek: 3, active: true }))

        await expect('trainer writes well-formed target overrides', 'allow', () =>
            updateDoc(doc(db, 'assignments', `${T.lowerA}_${uid.maya}`), {
                timesPerWeek: 3,
                active: true,
                targetOverrides: {
                    'back-squat': {
                        versionId: 'v1',
                        basis: [{ weightKg: 60, reps: 5 }],
                        sets: [{ weightKg: 65, reps: 5 }],
                    },
                },
            }))

        await expect('trainer clears target overrides', 'allow', () =>
            updateDoc(doc(db, 'assignments', `${T.lowerA}_${uid.maya}`), {
                timesPerWeek: 2, active: true, targetOverrides: {},
            }))

        // Guards ticket 08's overridesWellFormed() clause, which is deployed. A
        // failure here means the published ruleset has drifted back to accepting
        // any shape in targetOverrides - the field is read as a map on every
        // resolve, so a string or an array there breaks the targets screen for
        // whichever Client it was written to.
        await expect('trainer writes malformed target overrides', 'deny', () =>
            updateDoc(doc(db, 'assignments', `${T.lowerA}_${uid.maya}`), {
                timesPerWeek: 2, active: true, targetOverrides: 'not-a-map',
            }))
    } finally {
        await restoreFixture()
    }

    await expect('trainer writes a Session for his client', 'deny', () =>
        setDoc(doc(db, 'sessions', 'forged-by-trainer'), {
            clientId: uid.maya, status: 'completed', exercises: [],
        }))

    // ADR 0002: a Version is immutable. A write to an existing document is an
    // update, never a create, so the author's create permission cannot be used
    // to overwrite one by reusing its id.
    await expect('trainer overwrites his own existing Version', 'deny', () =>
        setDoc(doc(db, 'workoutTemplates', T.lowerA, 'versions', 'v1'), {
            versionNumber: 1, exercises: [],
        }))

    await expect('trainer deletes his own Template', 'deny', () =>
        updateDoc(doc(db, 'workoutTemplates', T.lowerA), { authorId: uid.patrick }))

    await expect('trainer edits another trainer\'s Template', 'deny', () =>
        updateDoc(doc(db, 'workoutTemplates', T.fullBody), { name: 'Stolen' }))

    await expect('trainer creates a Version under another trainer\'s Template', 'deny', () =>
        setDoc(doc(db, 'workoutTemplates', T.fullBody, 'versions', 'v99'), {
            versionNumber: 99, exercises: [],
        }))

    // The forged-id attack the create rule exists to stop: a well-formed id
    // naming someone else's template would hand his own client read access to
    // it, because the template's read rule only tests that the path exists.
    await expect('trainer assigns a Template he does not own', 'deny', () =>
        setDoc(doc(db, 'assignments', `${T.fullBody}_${uid.maya}`), {
            templateId: T.fullBody, clientId: uid.maya, trainerId: uid.zephyr,
            timesPerWeek: 2, active: true,
        }))

    await expect('trainer assigns to another trainer\'s client', 'deny', () =>
        setDoc(doc(db, 'assignments', `${T.lowerA}_${uid.tom}`), {
            templateId: T.lowerA, clientId: uid.tom, trainerId: uid.zephyr,
            timesPerWeek: 2, active: true,
        }))

    await expect('trainer reads another trainer\'s client\'s Sessions', 'deny', () =>
        getDocs(query(collection(db, 'sessions'), where('clientId', '==', uid.tom))))

    // === Patrick: the other trainer ======================================
    await as('patrick')

    await expect('trainer reads a Template he authored', 'allow', () =>
        getDoc(doc(db, 'workoutTemplates', T.conditioning)).then((s) => {
            if (!s.exists()) throw new Error('document missing')
        }))

    await expect('trainer reads another trainer\'s Template', 'deny', () =>
        getDoc(doc(db, 'workoutTemplates', T.lowerA)).then((s) => {
            if (!s.exists()) throw new Error('missing, not denied')
        }))

    await expect('trainer reads an Assignment he owns', 'allow', () =>
        getDoc(doc(db, 'assignments', `${T.fullBody}_${uid.tom}`)).then((s) => {
            if (!s.exists()) throw new Error('document missing')
        }))

    // === Unassigning is a soft removal ===================================
    //
    // The one guarantee no single rule states out loud. The workoutTemplates
    // read rule tests that an Assignment *exists* and never that it is active,
    // so a Client whose training block has ended keeps access to the Template
    // and the Versions their past Sessions cite - which is what keeps a
    // finished block's history readable rather than a list of names with
    // nothing behind them. Deleting the document instead would take that with
    // it, and is why nothing in the app ever deletes one.
    //
    // Mutating, and across two identities, so the restore signs back in rather
    // than assuming who is holding the connection.
    await as('zephyr')
    try {
        await expect('trainer unassigns his own Assignment', 'allow', () =>
            updateDoc(doc(db, 'assignments', `${T.lowerA}_${uid.maya}`), { active: false }))

        await as('maya')

        await expect('unassigned client still reads the Template her Sessions cite', 'allow', () =>
            getDoc(doc(db, 'workoutTemplates', T.lowerA)).then((s) => {
                if (!s.exists()) throw new Error('document missing')
            }))

        await expect('unassigned client still reads that Template\'s Version', 'allow', () =>
            getDoc(doc(db, 'workoutTemplates', T.lowerA, 'versions', 'v1')).then((s) => {
                if (!s.exists()) throw new Error('version missing')
            }))
    } finally {
        // Swallowed only so a failed sign-in cannot mask the restore below,
        // which reports its own failure either way.
        await as('zephyr').catch(() => {})
        await restoreFixture()
    }

    await signOut(auth).catch(() => {})

    // --- result -----------------------------------------------------------

    console.log(`\n${'='.repeat(60)}`)
    console.log(`${passed} passed, ${failures.length} failed`)
    if (failures.length) {
        console.log('\nFailures:')
        failures.forEach((f) => console.log(`  - ${f}`))
        process.exit(1)
    }
    console.log('\nAll rule expectations held.')
    process.exit(0)
}

main().catch((e) => {
    console.error('\nHARNESS ERROR:', e.message)
    process.exit(1)
})
