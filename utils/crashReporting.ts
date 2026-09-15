import Constants from 'expo-constants'
import * as Sentry from '@sentry/react-native'

/**
 * The one place the app talks to a crash reporter.
 *
 * Sentry rather than Crashlytics because this beta is web-first and Crashlytics
 * is native-only; @sentry/react-native carries @sentry/browser and
 * @sentry/react as dependencies and picks the right one per platform, so web
 * and native report through a single SDK and a single DSN.
 *
 * **With no DSN configured this module does nothing at all** - no init, no
 * handlers installed, no console noise, and `reportError` returns immediately.
 * That is the state the app ships in until the Sentry account exists, and a
 * tester on such a build must not be able to tell the difference. Importing the
 * SDK is safe on its own: Sentry installs nothing until `init` is called, and
 * `captureException` on an uninitialised client is a no-op. The `started` guard
 * below makes that explicit rather than relying on it.
 */

// A Sentry DSN is public by nature and has to be: it ships inside every web
// bundle and every app binary, and the single permission it grants is to
// *submit* an event. It can read nothing back and spend nothing, which is why
// Sentry documents it as safe to expose. That makes this the opposite call from
// YOUTUBE_API_KEY in .env.example, which buys quota against a billing account
// and so is deliberately un-prefixed and never bundled.
//
// It is also the only workable call: EXPO_PUBLIC_ is the sole prefix Expo
// inlines into the client bundle, so a DSN spelled any other way would simply
// be undefined at runtime and reporting would be silently dead.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN

let started = false

/**
 * Called once from the root layout, as early as a module can run.
 *
 * Idempotent, because Fast Refresh re-executes module scope and a second init
 * would install a second set of global handlers.
 */
export const initCrashReporting = () => {
    if (started || !DSN) return

    Sentry.init({
        dsn: DSN,
        // Tags every event with app.json's version, which is the only way to
        // tell a crash on the build a tester installed last week from the same
        // crash on today's. Read through expo-constants rather than importing
        // app.json, so this file has no opinion about the manifest's shape.
        release: Constants.expoConfig?.version ?? undefined,
        // Errors only. Performance tracing is a separate quota and a separate
        // privacy disclosure (it records URLs and timings for every screen), and
        // this ticket is about hearing that something broke.
        tracesSampleRate: 0,
        // The app handles health data about identifiable people, so the default
        // "attach whatever identifies the user" is the wrong default here - see
        // docs/legal/privacy.md, which says we do not send Sentry an identity.
        sendDefaultPii: false,
    })

    started = true
}

/**
 * Report a caught error, with whatever context the caller has.
 *
 * Separate from Sentry's global handlers because the interesting errors in this
 * app are the ones React already caught for us - a render crash reaches
 * componentDidCatch and never becomes an unhandled exception, so without this
 * call the recovery screen would appear and nothing would be reported.
 */
export const reportError = (error: unknown, context?: Record<string, unknown>) => {
    if (!started) return
    Sentry.captureException(error, context ? { extra: context } : undefined)
}
