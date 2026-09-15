const MESSAGES = {
    'auth/email-already-in-use': 'That email is already registered. Try logging in instead.',
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    // Firebase refuses a delete (and a password or email change) on a session
    // that has been signed in for a while. The delete flow re-authenticates up
    // front so this should not surface, but a token can expire between typing
    // the password and the delete landing - and the fix the user needs to hear
    // is "sign in again", which the raw code does not say.
    'auth/requires-recent-login': 'For your security, please sign out, sign back in, and try again.',
    // Raised by reauthenticateWithCredential when the credential names a
    // different user from the one signed in. A plain wrong password there is
    // auth/invalid-credential, already mapped above - this is the rarer case,
    // and without an entry the delete sheet would show a raw Firebase string at
    // the most alarming moment in the app.
    'auth/user-mismatch': 'That password is for a different account.',
    'auth/missing-password': 'Please enter your password.',
    // The rules rejected the write. Every caller that can produce a more
    // specific sentence than this one already does (see the trainer-code branch
    // in AuthContext.signUp); this is the honest fallback for the rest.
    'permission-denied': "You don't have permission to do that.",
    unavailable: "Can't reach the server. Check your connection and try again.",
}

export const getAuthErrorMessage = (error) => {
    return MESSAGES[error?.code] ?? error?.message ?? 'Something went wrong. Please try again.'
}
