/**
 * Whether an email address is worth sending to Firebase.
 *
 * Deliberately loose - one @, something either side, and a dot in the domain.
 * Firebase is the real judge; this only exists so that "maya@greenpulse"
 * (no ".fit") is told it isn't an address, instead of the "Incorrect email or
 * password" Firebase answers it with, which sends people hunting for a
 * password typo that isn't there.
 */
export const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
