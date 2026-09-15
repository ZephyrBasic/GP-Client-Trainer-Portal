# The account-deletion web page Google Play requires

**This is a brief, not a document to publish as-is.** Google Play requires an account-deletion URL
that works **without installing the app** — you submit it in Play Console under Policy → App content
→ Data safety. Apple does not require the page, only the in-app path, which ticket 02 built.

The page belongs on the website, which is outside this repo. Suggested URL:
**`https://greenpulse.fit/delete-account`**, linked from the privacy policy's deletion section.

## What Play checks for

Play's reviewers look for a page that, without an app install and without signing in, states:

1. **Who it is for** — the app it belongs to, named as it appears on the store listing.
2. **How to request deletion** — at least one route that does not require the app. For us that is
   emailing **privacy@greenpulse.fit** from the registered address.
3. **What is deleted** and **what is retained**, with the retention period for anything kept.

A page that only says "delete it in the app" is routinely rejected.

## What ours has to say

Take the wording from `privacy.md` → "Deleting your account" rather than writing it twice; the two
must not drift. The substance:

**Two routes.** In the app: Profile → Delete my account, confirmed with your password. Without the
app: email **privacy@greenpulse.fit** from the address you registered with. We act within 30 days and
confirm when it is done.

**Deleted.** Your sign-in, your profile (name, email, role, the trainer you are linked to, your
invite code), every session you have logged and the sets in them, any progress media and the files
behind it, any custom exercises you created.

**Retained, and why.** Workout plans and their versions, assignments, sent messages, and comments on
your media — because other people's records point at them and removing one would make another
person's own history unreadable. None of it carries your name or email once your profile is gone.
Retained indefinitely for that reason; erased on request by emailing us.

**Trainers with clients.** The in-app path is blocked until your clients have moved to another
trainer, because nothing in the app can re-link them afterwards. Email us and we will handle it.

## When the page changes

Any change to `utils/deleteAccount.ts` — what it deletes, what it leaves — changes this page and
`privacy.md` with it. Play re-checks the URL on each submission, so a page that has drifted from the
app's actual behaviour is a rejection waiting to happen.
