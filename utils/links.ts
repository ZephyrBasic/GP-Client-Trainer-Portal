// Everywhere the app points at something outside itself.
//
// One module rather than a literal per screen, because four of these five values
// are promises made in a published document: docs/legal/privacy.md names
// privacy@greenpulse.fit as the operator's contact and is itself served at the
// URL below. A screen that quietly linked somewhere else would make the
// published policy wrong rather than merely inconsistent.
//
// The legal text deliberately lives on the website and not in the app. One
// canonical copy that can be corrected without a store review beats two copies
// that drift, and a policy has to be readable by someone who has not installed
// anything.

/** Served from greenpulse.fit; the source of both is docs/legal/. */
export const PRIVACY_URL = 'https://greenpulse.fit/privacy'
export const TERMS_URL = 'https://greenpulse.fit/terms'

/**
 * Both are forwarding addresses on the greenpulse.fit domain, and neither
 * mailbox exists until the forwards are configured - a link to an address that
 * bounces is worse than no link, so check these resolve before a beta invite
 * goes out.
 */
export const PRIVACY_EMAIL = 'privacy@greenpulse.fit'
export const FEEDBACK_EMAIL = 'feedback@greenpulse.fit'

export type FeedbackContext = {
    /** 'trainer' | 'client', or undefined when we crashed before the profile loaded. */
    role?: string | null
    /** Platform.OS at the call site - this module stays free of the RN runtime. */
    platform?: string | null
    /** app.json's version, read through expo-constants by the caller. */
    version?: string | null
    /** Pre-fills the subject; defaults to plain feedback. */
    subject?: string
    /** Seeds the body above the context block - a crash message, say. */
    note?: string
}

/**
 * A feedback mail pre-filled with the three facts a tester would never think to
 * include and that we cannot work without: which build, which platform, and
 * which side of the trainer/client relationship they were on. Everything a bug
 * report needs except the bug.
 *
 * A mailto rather than an in-app form on purpose: a form needs a collection, a
 * rule, a screen and a place to read it, and the whole point of this link is
 * that it works during the beta, including when the thing that broke is
 * Firestore.
 */
export const buildFeedbackMailto = ({
    role,
    platform,
    version,
    subject = 'GreenPulse feedback',
    note,
}: FeedbackContext = {}): string => {
    const context = [
        note ? `${note}\n` : null,
        '---',
        `Version: ${version ?? 'unknown'}`,
        `Platform: ${platform ?? 'unknown'}`,
        `Role: ${role ?? 'unknown'}`,
    ]
        .filter(Boolean)
        .join('\n')

    const body = `\n\nWhat happened:\n\n\n${context}\n`

    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
