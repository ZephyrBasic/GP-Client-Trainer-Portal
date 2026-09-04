# Test accounts and seeded data

Created by `scripts/seed-test-data.js` against the live `gp-client-trainer-portal` project on
2026-08-28. **No sessions exist for these five accounts**, deliberately — each seeded client's history is
empty, so the first session anyone logs is one you can watch being written. The `sessions`
collection is not empty overall: it holds the 5 documents the migration copied across from a
pre-existing account, which are nobody's here.

Sign in at `npm run web`.

**Password for every account below: `GreenPulse!2026`**

These are throwaway accounts on the dev project. The password is shared, weak, and committed on
purpose so anyone can pick the fixture up. Delete them before this project holds anything real:
`node scripts/seed-test-data.js --reset`.

## Accounts

| Who | Email | Role | Trainer | UID |
|---|---|---|---|---|
| PT Zephyr | `pt.zephyr@greenpulse.test` | trainer | — | `BDssvM6hyGeDCZZEGKXme5jX8M42` |
| PT Patrick | `pt.patrick@greenpulse.test` | trainer | — | `GVoZs88SFNS08jQYc2ekyrLIPh13` |
| Maya Adeyemi | `maya@greenpulse.test` | client | Zephyr | `Y96jSekSgyaFwvSrtuWD9ZibK7N2` |
| Tom Brennan | `tom@greenpulse.test` | client | Patrick | `INT7Qt3Bm4cvUn8GfNJtBxeT4Dz2` |
| Priya Raman | `priya@greenpulse.test` | client | Patrick | `qJAPBnIhLhcRfaGayX5wivZ9SLU2` |

Trainer invite codes: **Zephyr `ZEPHYR`**, **Patrick `PATRK2`** — use these if you register a
further client through the app's own signup flow.

## Templates

All four are at **Version 1**, id `v1`. Template ids are slugs, not minted, so the seed is
idempotent and the documents are easy to find in the console.

### PT Zephyr

**Lower Body A** — `test-zephyr-lower-a`

| Exercise | Fields | Target sets |
|---|---|---|
| Back Squat | weight, reps | 3 × 60 kg × 5 |
| Dumbbell Romanian Deadlift | weight, reps | 3 × 40 kg × 8 |
| Copenhagen Plank | duration only | 3 × 45 s |

**Upper Body A** — `test-zephyr-upper-a`

| Exercise | Fields | Target sets |
|---|---|---|
| Barbell Bench Press | weight, reps | 4 × 50 kg × 5 |
| Dumbbell Overhead Press | weight, reps | 3 × 20 kg × 8 |

### PT Patrick

**Full Body Strength** — `test-patrick-full-body`

| Exercise | Fields | Target sets |
|---|---|---|
| Conventional Deadlift | weight, reps | 3 × 80 kg × 5 |
| Barbell Bench Press | weight, reps | 3 × 55 kg × 5 |

**Conditioning** — `test-patrick-conditioning`

| Exercise | Fields | Target sets |
|---|---|---|
| Farmer's Carry | weight, distance | 3 × 24 kg × 30 m |
| Copenhagen Plank | duration only | 2 × 60 s |

Two of these are chosen rather than arbitrary. **Copenhagen Plank declares duration and nothing
else**, and **Farmer's Carry declares weight and distance but not reps** — so the seeded targets
carry only the fields their exercise declares, and the absent ones are genuinely absent rather than
zero. **Conditioning has zero loaded volume by design**: the spec calls this case out, because the
verdict is a set-by-set comparison and must never become a subtraction of totals.

## Who is assigned what

| Client | Template | Frequency |
|---|---|---|
| Maya | Lower Body A | 2× / week |
| Maya | Upper Body A | 2× / week |
| Tom | Full Body Strength | 3× / week |
| Priya | Full Body Strength | 2× / week |
| Priya | Conditioning | 1× / week |

**Tom is deliberately not assigned Conditioning.** His own trainer wrote it, so he is the negative
case that matters most: authorship grants a client nothing, only an assignment does. Any bug that
leaks templates by trainer rather than by assignment shows up as Tom seeing Conditioning.

Assignment ids are the derived pair `templateId_clientId`, e.g.
`test-zephyr-lower-a_Y96jSekSgyaFwvSrtuWD9ZibK7N2`. That derivation is what makes the template read
rule possible at all — rules cannot run queries, so "is this client assigned?" has to be a path that
can be built and tested for existence.

## Things worth trying by hand

- **Two clients, one template, later different loads.** Tom and Priya are both on Full Body
  Strength. Once ticket 08 lands, give them different target loads and confirm each sees only their
  own — that is 08's entire demo.
- **Maya has two prescriptions**, so her workout list exercises the "from your trainer" section with
  more than one row.
- **Priya has both of Patrick's templates**, including the zero-volume one.
- **Nobody has any history yet.** Log the first session as Maya and watch it appear.

## Re-running

```bash
node scripts/seed-test-data.js --dry     # report, write nothing
node scripts/seed-test-data.js           # create or update in place
node scripts/seed-test-data.js --reset   # delete the accounts and documents
```

Idempotent: accounts are looked up by email before creation and every document id is a slug, so a
re-run updates rather than duplicating. Editing a template through the app and then re-running will
overwrite that template back to the seeded Version 1 contents — reset instead if you want a clean
slate.

## Rules smoke test

`scripts/smoke-test-rules.js` signs in as each account with the **client** SDK and asserts what
Firestore actually allows. It has to be the client SDK: the Admin SDK bypasses rules entirely, so it
can seed data but can never test authorization.

```bash
node scripts/smoke-test-rules.js
```

**Last run: 35 passed, 1 failed.** The failure is expected and informative: `trainer writes
malformed target overrides` is still *allowed*, because ticket 08's `overridesWellFormed` clause is
written but not yet deployed. It flips to passing after `firebase deploy --only firestore:rules`,
which is how this run distinguishes "rule not shipped" from "rule wrong".

**What it does not cover: the app.** These are the client SDK talking to Firestore directly. No
screen, hook, context or route has been exercised — signing in as these accounts in `npm run web` is
still the only way to test the flow itself.

It covers, among others:

- an assigned client reading her prescribed template and its version — the `exists()` clause that
  every prescription depends on
- a client reading his own trainer's *unassigned* template — denied
- a client promoting herself to trainer, or re-linking to another trainer — denied
- a trainer overwriting an existing version by reusing its id — denied, which is ADR 0002's
  immutability guarantee
- a trainer forging an assignment id that names another trainer's template — denied, which is the
  specific attack the id-verification clause exists to stop
- a trainer writing a session for his own client — denied; sessions stay the client's own
- a client creating, completing, reading and discarding her **own** session — allowed, the core
  action of the app, and the last thing to get covered because every earlier pass had only ever
  tested that a *trainer* could not do it
- the two trainer roster queries, mirroring `useClients` and `useTrainerAssignments` filter for
  filter, so a query the rules reject cannot pass here and fail in the app

Exits non-zero on any failure, so it can gate a commit.
