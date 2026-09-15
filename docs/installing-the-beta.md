# Installing the GreenPulse beta

The beta is the web app at **https://app.greenpulse.fit/**. You can just use it in a browser, but
installing it to your home screen is worth doing: it opens full-screen with no address bar, gets its
own icon, and keeps working if you lose signal mid-session.

## Android (Chrome)

1. Open **https://app.greenpulse.fit/** in Chrome.
2. Chrome offers **Install app** — either as a banner at the bottom or under the ⋮ menu.
3. Tap it, then **Install**.

That's it. The app appears in your launcher like any other.

## iPhone and iPad (Safari)

**iOS never offers to install a web app.** There is no prompt, no banner, and nothing in the ⋮ menu,
so you have to know the steps. You also have to use Safari — Chrome on iOS cannot do this.

1. Open **https://app.greenpulse.fit/** in **Safari**.
2. Tap the **Share** button (the square with an arrow coming out of the top).
3. Scroll down the list and tap **Add to Home Screen**.
4. Tap **Add**.

### You will have to log in again — this is not a bug

An installed web app on iOS gets **its own storage, completely separate from Safari's**. So the
moment you open it from the home screen, it knows nothing about the Safari session you were just
using: you are logged out, and any session you had started is not there.

Log in once inside the installed app and it stays logged in from then on. Do this *before* you head
to the gym, not at the squat rack.

## Losing signal

Once you have opened the app online at least once, it will open and render offline — so a gym
basement gets you the app rather than a blank page. Anything already loaded stays readable, and what
you record syncs when you have a signal again.

The one case that cannot work is the very first launch: if the app has never successfully loaded on
that device, there is nothing cached to show. Open it once on wifi before you rely on it.

## Reporting something

Say which platform, whether you were in the installed app or a browser tab, and whether you had a
signal. Those three facts separate most reports from each other.

---

## For the maintainer: version numbers

`app.json` carries three numbers that are easy to confuse.

- `version` (`1.0.0`) is the **marketing version** — what a user sees on a store listing. It moves
  when a release is worth naming, and can sit still across many builds.
- `ios.buildNumber` (`"1"`) and `android.versionCode` (`1`) are the **build identity**. Increment
  both on **every** submission, even a re-upload of an otherwise identical binary: neither store
  accepts a number it has already seen, and neither number can ever go down.

So they start together at `1.0.0` / `1` and then diverge, which is correct rather than something to
tidy up.

Two identifiers are permanent once a build is uploaded and must not be edited: `ios.bundleIdentifier`
and `android.package`, both `fit.greenpulse.app`. The `scheme` (`greenpulse`) is effectively
permanent too — it is what a Firebase password-reset link returns into on native, so changing it
breaks every link already sitting in someone's inbox.

`ios.supportsTablet` is `false` on purpose. Declaring iPad support makes a full 13" iPad screenshot
set mandatory for App Store submission and puts the app in front of a reviewer on an iPad, where
layouts only ever exercised at phone width become a rejection risk. Adding iPad support later is a
normal update.

The web manifest's `start_url` and `scope` are the relative `/`, not `https://app.greenpulse.fit/`.
A scope names an origin, so an absolute one makes every Cloudflare Pages preview on `*.pages.dev`
non-installable — and installing a preview on a phone is how a change gets tried as an installed app
before it reaches testers. JSON has no comments, which is why that reasoning lives here.

## For the maintainer: the icon

`assets/icon.png` is the **single source** for every icon: `app.json`'s `expo.icon` (compiled into
native builds) points at it, and the generator derives the store icon and the four install icons
from it. The generator reads that file but never writes it — so replacing only the generated icons
would leave native builds showing the old artwork, invisible until a build is on a phone.

**The current artwork is provisional.** It is the GreenPulse mark from `assets/img/gpLogo-black.png`,
which exists only at 500x500, upscaled to 1024 — slightly soft if you look closely at the store
icon. When true 1024x1024 artwork exists, the whole update is: overwrite `assets/icon.png`, then run

```bash
node scripts/generate-web-icons.js          # from assets/icon.png
node scripts/generate-web-icons.js --dry    # ... without writing
```

No code changes. The source must be square and opaque; the fill for the padded maskable icon is
taken from its corner pixel.
