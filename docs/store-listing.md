# Store listing

Everything the App Store and Google Play listings need, gathered once so neither has to be
re-derived at submission time. Copy here is a draft to edit, not a placeholder to replace.

**Every store requirement below was checked against the live specification on 2026-09-11.** These
numbers move — Apple retired the 12+ and 17+ age ratings in 2025 and changes the mandatory
screenshot size every couple of device generations — so re-check the sections marked *(verify)*
before a submission rather than trusting this file.

Related: `scripts/seed-test-data.js --review` (the reviewer accounts), `docs/test-accounts.md` (the
separate throwaway fixture), `CONTEXT.md` (the words used in the copy below),
`.claude/docs/demo/shots.js` (the screenshots).

---

## 1. Reviewer access

This is the part that gets an otherwise-finished submission rejected. GreenPulse is entirely behind
a login, and a Client additionally needs their Trainer's invite code, so a reviewer who taps
*Register* cannot get in at all. Apple rejects that under Guideline 2.1; Play sends it back through
the **App content → App access** form.

**Decided 2026-09-11: dedicated review accounts, one Trainer and one Client per store.** Not the
seeded fixtures. Two reasons, and both are failure modes rather than preferences:

- **The fixture password is committed to this repository**, deliberately, so anyone can pick the
  fixture up (`docs/test-accounts.md`). A public password must not be the thing standing between a
  stranger and a production account, and `docs/test-accounts.md` itself says the fixtures are to be
  deleted before the project holds anything real. Using them for review would mean keeping them
  alive, in production, with that password, for as long as the app is listed.
- **Two reviewers cannot share one Client account.** The single-active-Session rule is enforced by
  the UI and not by Firestore (ADR 0003), so Apple's reviewer and Google's, reviewing concurrently,
  would see each other's open Session and be told they already have a workout in progress. It reads
  as a bug in the app, and it is the reviewer who writes it up.

A third consequence follows: `node scripts/seed-test-data.js --reset` is now safe to run during a
live review. It deletes the fixture only, and the review cohort is a separate `--review` target.

Where the credentials go:

| Store | Field |
|---|---|
| App Store Connect | Version page → **App Review Information** → demo account username, password, and **Notes** |
| Play Console | **App content** → **App access** → *Some functionality is restricted* → up to five sets of **Sign-in details**, plus *Any other instructions* |

Apple allows one demo account in the structured fields, so the second one goes in Notes. Play takes
both as separate sign-in instructions.

### The accounts

`scripts/seed-test-data.js --review` creates and maintains them. Each store gets its own pair, and
each pair shares one password — the separation that matters is between the two reviewers, not
between the two roles one reviewer signs into.

| Store | Role | Email | Invite code |
|---|---|---|---|
| Apple App Review | Trainer | `apple.trainer@review.greenpulse.test` | `APLREV` |
| Apple App Review | Client | `apple.client@review.greenpulse.test` | — |
| Google Play review | Trainer | `google.trainer@review.greenpulse.test` | `GOOREV` |
| Google Play review | Client | `google.client@review.greenpulse.test` | — |

They sit under `review.greenpulse.test` rather than the fixture's `greenpulse.test`: `.test` is the
reserved, undeliverable TLD either way, and the subdomain makes the cohort obvious in the Firebase
Auth console and greppable in the script.

Each review Client arrives with two assigned Workout Templates at a Target Frequency, and two
finished Sessions inside the trailing week — one *As Prescribed* and one *Modified*, so the verdict
and the diff both have something to show and the Trainer's weekly completion card has real numbers
in it. A reviewer who signs in to empty lists cannot evaluate the app, and says so.

### The passwords

**Never committed.** The script takes them from the environment if they are there and mints one
otherwise, and a minted password is printed once at the end of the run — Firebase keeps only a hash,
so it cannot be read back afterwards.

To choose them yourself, add these to `.env` (gitignored) before seeding:

```
REVIEW_PASSWORD_APPLE=...
REVIEW_PASSWORD_GOOGLE=...
```

Otherwise the run prints what it minted; paste it straight into the store console. An account that
already exists keeps the password it has — re-seeding never rotates silently, because the credential
may already be sitting in a live submission. `--rotate` is the explicit way to mint a new one when
the old one is lost.

```bash
node scripts/seed-test-data.js --review --dry     # report, write nothing
node scripts/seed-test-data.js --review           # create or update
node scripts/seed-test-data.js --review --rotate  # ... and mint new passwords
node scripts/seed-test-data.js --review --reset   # delete the review cohort
```

### Ready to paste

> GreenPulse pairs a personal trainer with their clients. A trainer writes workout templates and
> assigns them to clients with per-client target loads; a client performs a session against one,
> ticking off each set as they go, and every finished session is compared against the plan and
> marked As Prescribed or Modified.
>
> The whole app is behind a sign-in, and the two roles see different screens, so please use both
> accounts below. Start with the client.
>
> CLIENT — sees their prescribed workouts and performs one
> email: apple.client@review.greenpulse.test
> password: <password printed by the seed run>
> On sign-in you land on Today. The card at the top is the next prescribed workout; press START to
> open a live session, tick the checkboxes beside a few sets, then press FINISH and Save session.
> The record that opens carries the verdict and a set-by-set comparison against the plan. Two
> earlier sessions are already in the History tab, one of each verdict.
>
> TRAINER — sees the roster and authors the workouts
> email: apple.trainer@review.greenpulse.test
> password: <the same password>
> On sign-in you land on Roster. Open the client to see their sessions and weekly completion; the
> Library tab holds the workout templates and the screens for assigning them and setting a client's
> own target loads.
>
> Registration is not needed for review, but if you want to try it: a client account requires the
> invite code of the trainer they are joining. The trainer account above uses the code APLREV.
>
> There are no purchases, no subscriptions and no ads. Exercise how-to clips are embedded YouTube
> videos and need a network connection.

Swap the two emails and the invite code for `google.*` / `GOOREV` in the Play Console. Fill the
password in from the seed run's output; it is not written down anywhere in this repository.

---

## 2. Asset checklist

### App icon

| | Apple | Google Play |
|---|---|---|
| Size | 1024 × 1024 | 512 × 512 |
| Format | flattened PNG or JPEG, sRGB | 32-bit PNG |
| Alpha | **not allowed** — an all-opaque alpha channel still fails validation | documented as 32-bit, which implies one; the file on hand has none — see below |
| Corners | **do not round them**; iOS applies its own mask, and a pre-rounded icon double-rounds | Play applies its own mask too |
| Max file size | — | 1024 KB |

**The two stores want opposite things from the alpha channel**, so these are two exports and not one
file used twice — Apple fails validation on any alpha channel at all, even one where every pixel is
fully opaque, while Play's documented format is "32-bit PNG with alpha", and 32-bit PNG *means* RGBA.

**The 512 is currently a 24-bit PNG with no alpha** (`public/icons/icon-512.png`, colour type 2).
That is what Play's *screenshot* and *feature graphic* rules want, but it is not the wording of the
icon rule. Try the upload — the console is the only authority on what it actually accepts — and if
it refuses the file, the fix is to re-save it with a fully opaque alpha channel rather than to
redraw anything.

**Apple's icon is not uploaded to App Store Connect.** It comes out of the app build — Apple's own
help is explicit that you add the icon to the Xcode asset catalog and upload the build, and that
changing it later means a new version and a new build. Under Expo that means `app.json` →
`expo.icon`, which is `assets/icon.png`. So `assets/store-icon-1024.png` is the reference export and
the *verification* that the artwork is alpha-free and unrounded; what actually ships to Apple is
whatever `expo.icon` points at. The two must stay the same picture.

Play's 512 × 512 *is* uploaded in the console, by hand, on the store listing page.

*(verify: Apple's icon requirements are design-guideline material and shift with each iOS icon
system; re-read the Human Interface Guidelines app-icons page before exporting.)*

### The icons are still the Expo placeholder — this blocks submission

`assets/icon.png` is the stock Expo placeholder, the grey concentric circles, and **every icon above
is generated from it**. Both stores will show exactly that to every user who sees the listing, and
neither will tell you it is wrong.

The real artwork is `assets/img/gpLogo-black.png`, but it is 500 × 500 and would upscale softly to
1024. So this is an artwork problem rather than a tooling one — but it needs **two** fixes, because
the icon that ships and the icons that are uploaded come from different places:

1. **Replace `assets/icon.png` itself** with real square artwork at 1024 × 1024. That file is what
   `app.json` → `expo.icon` points at, so it is the icon inside the iOS and Android builds.
   `scripts/generate-web-icons.js` reads it but never writes it.
2. **Regenerate the derived set**: `node scripts/generate-web-icons.js --source <file>` (defaults to
   `assets/icon.png`), which rewrites `assets/store-icon-1024.png` and the four PWA icons under
   `public/icons/`, all as truecolour PNG with no alpha. `--dry` reports without writing.

Nothing else in this document is blocked by it. The listing simply must not be submitted until both
are done.

### Screenshots — iPhone *(verify)*

Apple requires screenshots for **at least one iPhone display size**. The 6.9" set is the one to
supply; 6.5" is only mandatory as a fallback when 6.9" is absent, and every smaller size is scaled
down automatically from what you give.

| Display | Portrait | Notes |
|---|---|---|
| 6.9" | **1320 × 2868** | also accepted: 1290 × 2796, 1260 × 2736 |
| 6.5" | 1284 × 2778 | required only if no 6.9" set is provided |

1 to 10 per size. `.png`, `.jpg` or `.jpeg`, standard RGB, **no alpha channel**.

### Screenshots — iPad: not needed *(verify)*

Apple's spec requires iPad screenshots **if the app runs on iPad**, and `app.json` had
`ios.supportsTablet: true`. That flag is being set to **false** for the beta, so the iPad set is not
required and the listing is iPhone-only.

If tablet support ever comes back, so does this requirement, and the size is 13" iPad **2064 × 2752**
portrait (2048 × 2732 also accepted). `shots.js --ipad` still produces it.

### Screenshots — Android phone

- **At least 2** to publish, up to **8** per form factor.
- JPEG or 24-bit PNG, **no alpha**.
- Each side between 320 px and 3840 px, and the long side no more than twice the short side.
- Play recommends at least 4 at 1080 px or better, 9:16 portrait — minimum **1080 × 1920**, which is
  what the harness produces.

### Feature graphic — Google Play only

**1024 × 500**, JPEG or 24-bit PNG, no alpha. Required to publish. Exactly that size — Play accepts
no other ratio and does not scale. It is cropped differently on different surfaces, so keep the app
name and any text away from the edges.

No equivalent exists on the App Store.

### Where each asset comes from

| Asset | Source |
|---|---|
| 1024 × 1024 iOS icon | `assets/store-icon-1024.png` — 1024 × 1024, truecolour, no alpha, no pre-rounded corners. Ready |
| 512 × 512 Play icon | `public/icons/icon-512.png` — 512 × 512, truecolour, no alpha, 37 KB. See the caveat below |
| iPhone and Android screenshots | `node .claude/docs/demo/shots.js` — section 7 |
| Play feature graphic | hand-made; there is no screen to capture. Wordmark on the brand green (`#1E7546` light, `#51B67A` dark — `constants/Colors.ts`), no screenshot inside it |

---

## 3. Listing copy

Character limits, checked 2026-09-11: App Store name 30, subtitle 30, promotional text 170,
description 4000, keywords 100. Play app name 30, short description 80, full description 4000.

**App name** — `GreenPulse` (10). If the longer form is wanted for search:
`GreenPulse: Trainer & Client` (28), within both limits.

**Apple subtitle** (30) — `Prescribe, perform, compare` (27)

**Play short description** (80) —
`Your trainer writes the workout. You tick off every set as you actually do it.` (78)

**Apple promotional text** (170) — editable without a new build, so keep it current:
`The prescribed workout is already on your Today screen, with the loads your own trainer set for
you. Tick off each set. See exactly how it compared.` (148)

### Full description (both stores)

> GreenPulse is a workout tracker for a personal trainer and the people they coach. The trainer
> writes the plan; the client performs it and records what actually happened.
>
> FOR CLIENTS
>
> • Your next workout is already on the Today screen, carrying the target loads your trainer set for
> you — not the generic ones on somebody else's copy of the same plan.
> • Tick off each set as you finish it. The clock runs from when you started, not from when you
> remembered to press something.
> • Every finished session is compared against the plan set by set and marked As Prescribed or
> Modified. Modified is not a failure — it is a note to your trainer about what actually happened,
> and most good sessions are Modified.
> • No plan today? Start a session without one and build it as you go.
> • Over 200 exercises in the catalogue, most with a short how-to clip, so you are never guessing
> what a movement is.
>
> FOR TRAINERS
>
> • Write a workout template once and assign it to as many clients as you like.
> • Give each client their own target loads on that same template. Progressing one client's weights
> leaves everyone else exactly where they were.
> • Editing a template publishes a new version. Earlier versions are never overwritten, so a session
> performed last month still means what it meant last month.
> • Set a target frequency per client — twice a week, three times a week — and see at a glance who
> is behind. There are no due dates and no red overdue badges, because a frequency is an expectation
> and not a schedule.
> • Open any session a client logged and see exactly what changed against what you asked for.
>
> GreenPulse has no feed, no leaderboard, no streaks and nothing to buy. It is the conversation
> between one trainer and one client about one workout, written down.
>
> Signing in is required. Clients join using an invite code from their own trainer.

Roughly 1,900 characters, well inside 4,000. The claims in it are all things the app does today;
check them again if messaging or progress media are switched back on (`CLAUDE.md`, "Current
scope"), since both would add a paragraph.

**Apple keywords** (100, comma-separated, no spaces, and do not repeat words already in the name or
subtitle):
`personal trainer,coach,gym,strength,lifting,workout plan,sets,reps,training log,fitness,client`
(94)

---

## 4. Category

| Store | Choice |
|---|---|
| App Store primary | **Health & Fitness** |
| App Store secondary | **Sports** |
| Google Play | **Health & Fitness** (app, not game) |

Health & Fitness over Business on both. The app is used in a gym by the person training, not at a
desk by the person invoicing — there is no scheduling, billing or client management here beyond the
roster.

---

## 5. Content ratings

One questionnaire per store. Both are declarations about the app as it ships, so **the answers below
are true only while messaging and progress media stay switched off** (`app/(tabs)/_layout.tsx`,
`href: null`). Re-enabling either one changes them; see the end of this section.

### Google Play — the IARC questionnaire

Play requires an IARC rating to publish. One questionnaire produces every regional rating at once
(ESRB, PEGI, USK, ClassInd, GRAC, ACB). It asks about violence, sexual content, profanity,
controlled substances, in-app purchases, and whether the app collects data from children under 13.

| Question | Answer | Why |
|---|---|---|
| Category | Reference, News, or Educational — **not** a game | It is a tool, and answering "game" changes the whole questionnaire |
| Violence, blood, sexual content, profanity, horror | No | Nothing in the app depicts any of it |
| Controlled substances (drugs, alcohol, tobacco) | No | The catalogue has no supplement content |
| Gambling, simulated gambling | No | — |
| In-app purchases | No | Nothing is sold |
| Users can interact, exchange content or share location | **No, while messaging is off** | See below |
| User-generated content shared with other users | **No** | A Client's sessions are visible to their own Trainer, which is the coaching relationship, not publishing to an audience |
| Collects personal information | Yes — name, email, and fitness activity | Matches the privacy policy (ticket 03) |
| Directed at children under 13 | No | Target audience is 18+; set the same answer on Play's **Target audience and content** form |

Expected outcome: the lowest tier everywhere — ESRB Everyone, PEGI 3. A health-and-fitness tool with
no social surface has nothing for the questionnaire to raise.

### App Store — the age rating questionnaire *(verify)*

Apple replaced 12+ and 17+ with 13+, 16+ and 18+ in July 2025, and answering the updated questions
became mandatory for new submissions in September 2026. The questionnaire now covers in-app
controls, app capabilities, **medical or wellness topics**, violent themes, and **social media
capability** — defined as redistributing, amplifying or interacting with user-generated content
through a feed or similar discovery surface.

| Question | Answer | Why |
|---|---|---|
| Violence, sexual content, profanity, horror, mature themes | None | — |
| Gambling, contests | None | — |
| Medical or treatment information | **None** | GreenPulse gives no health advice. It records what a human trainer prescribed; the app never generates a recommendation |
| Health or wellness topics | **Infrequent/Mild** is the honest answer | It is a fitness tracker. It does not discuss diet, weight or body image anywhere |
| Social media capability | **No** | No feed, no following, no discovery. A Trainer sees their own Clients' sessions and nothing else |
| User-generated content | No | Session notes go to one Trainer; there is no shared surface |
| Unrestricted web access | **No** | The only external content is a fixed YouTube embed for a specific exercise demo, not a browser. Worth mentioning in App Review Notes so it is not read as a hidden browser |
| Age verification / parental controls in app | None | — |
| Made for Kids | No | — |

Expected outcome: **4+**, with 13+ the worst case if the wellness question is read strictly.

### What changes if the gated features come back

- **Messaging on** (`app/(tabs)/messages/`) — Trainer and Client can exchange free-text messages.
  Play's "users can interact" becomes Yes, Apple's user-generated-content answers change, and both
  stores then expect moderation, reporting and blocking to exist. Apple's Guideline 1.2 requires a
  way to report and block for user-generated content; a private one-to-one coaching channel is the
  mildest form of it, but the answer is still not No.
- **Progress media on** (`app/(tabs)/progress/`) — Clients upload photos and video of themselves.
  That is user-generated content *and* sensitive personal data; it changes the rating answers, the
  privacy policy, Play's Data safety form and Apple's App Privacy nutrition label together.

Neither is a small edit to this file. Re-answer both questionnaires from scratch.

### Adjacent forms this does not cover

Both stores also want a privacy policy URL, Play wants the **Data safety** form and the ads
declaration (answer: no ads), and Apple wants the **App Privacy** labels. Those belong with the
privacy policy work (beta-launch ticket 03) — they are listed here only so nothing is missed at
submission.

---

## 6. The embedded YouTube demos: do not block the ads

"Next Steps List.txt" item 8 reads *"The How to video links are too long. The videos should be
shorts. We need a way to block the ads."* The first half is done — ADR 0006 settled a 60-second
ceiling measured from real durations. **The second half must not be done.**

The YouTube API Services Terms forbid it directly: an API client must not block, modify or replace
advertisements served through the service, must not obscure attribution shown in an embedded
player, and must not overlay or alter the player's appearance. `components/YouTubePlayer.web.tsx`
and `components/YouTubePlayer.tsx` are exactly such clients.

Shipping an ad-stripped embed risks the embed being cut off at YouTube's end, and is a plausible
rejection at both stores as well — Apple and Google both decline apps that circumvent a third
party's terms, and Google reviews the app that is blocking Google's own ads.

The fix already planned is the right one: **replace borrowed clips with self-hosted footage.** Our
own video has no ads to block, needs no third-party terms, and removes the network dependency the
review notes currently have to mention. Until then the demos play with whatever YouTube serves.

---

## 7. Screenshots come from the demo harness

`.claude/docs/demo/` drives the running web app with Playwright. `shots.js` is the store-screenshot
mode: it sizes the viewport so that viewport × device pixel ratio lands exactly on the pixel size
each store demands, strips the demo video's caption strip, and saves JPEGs.

**JPEG, not PNG, on purpose.** Both stores reject an alpha channel in a screenshot, and Chromium
writes PNG as RGBA whether or not a single pixel is transparent. JPEG has no alpha to reject and
both stores accept it, so nothing has to be flattened afterwards.

### Running it

Playwright is not a project dependency — `scripts/` and `.claude/docs/demo/` both stay plain `.js`
under bare node, and the harness is occasional tooling rather than a gate. Install it for the run:

```bash
npm i --no-save playwright          # browsers already cached in ~/AppData/Local/ms-playwright
npm run web                         # in another terminal; must be on port 8081

node .claude/docs/demo/shots.js             # both phone sizes
node .claude/docs/demo/shots.js --ios       # 1320 x 2868 only
node .claude/docs/demo/shots.js --android   # 1080 x 1920 only
node .claude/docs/demo/shots.js --ipad      # 2064 x 2752, only if iPad support returns
node .claude/docs/demo/shots.js --headed    # watch it drive the app
```

Output lands in `.claude/docs/demo/store/<target>/`, which is wiped at the start of each run. The
script exits non-zero if any shot was missed and names which.

**It signs in as the fixture accounts and performs a real Session as Maya**, because a verdict
screenshot needs a finished Session and the fixture deliberately ships with none
(`docs/test-accounts.md`). That Session is written to the live project and stays there; running the
script twice logs two. Shots are independent, so one broken selector costs one image rather than
the run.

### What it captures, and why each one is there

| File | Screen | Why it earns a slot |
|---|---|---|
| `01-today` | Today, hero card | The promise in one frame: your next workout, your loads, your week so far |
| `02-today-dark` | Today, dark | Proves the app is properly themed, and reads differently enough in a gallery to be worth a slot |
| `03-live-session` | A live session | What the app actually is — targets pre-filled, a checkbox per set, the clock running |
| `04-verdict` | A finished session, comparison open | The differentiator. Nothing else in this category tells you set by set how the session departed from the plan |
| `05-history` | Session history | Answers "what do I get out of using this for a month" |
| `06-roster` | Trainer roster | The other half of the product. A trainer deciding whether to put their clients on this needs to see their own screen |
| `07-client-review` | One client's sessions and weekly completion | What a trainer opens the app for |
| `08-client-targets` | Per-client target loads | The thing a trainer cannot do in a shared spreadsheet |

Eight is Play's maximum per form factor and inside Apple's ten, so all of them can be uploaded —
but the first three carry the listing, because that is roughly what either store shows in search
results. Ship five or six; the rest are a menu.

The trainer shots navigate straight to their routes using the fixture's documented ids, which is
why the seed uses slugs rather than minted ids. If a template id in `docs/test-accounts.md` ever
changes, `08-client-targets` is the shot that breaks.

---

## 8. Still to do by hand

- **Seed the review accounts**: `node scripts/seed-test-data.js --review --dry`, then without
  `--dry`. It writes to the live project, so it is Zephyr's to run. Copy the two printed passwords
  into the store consoles before closing the terminal — a minted one cannot be read back.
- **Replace `assets/icon.png` with real 1024 × 1024 artwork, then run
  `node scripts/generate-web-icons.js`. This blocks submission.** Every icon in the repo is currently
  derived from the stock Expo placeholder, and the only GreenPulse artwork on hand
  (`assets/img/gpLogo-black.png`) is 500 × 500, which upscales softly. Both steps are needed — the
  generator reads `assets/icon.png` but never writes it.
- **Make the 1024 × 500 feature graphic.** No screen produces it, and no icon file substitutes.
- **Run `shots.js`** — it needs the dev server and the live Firebase project, which are Zephyr's.
- **Fill both consoles**: the copy in section 3, the category in section 4, the questionnaires in
  section 5, the privacy policy URL and the Data safety / App Privacy forms from ticket 03.
- **Rotate or delete the review accounts** once the app is listed and reviews are done:
  `node scripts/seed-test-data.js --review --reset`. They are production accounts with a standing
  password; they should not outlive their purpose.
