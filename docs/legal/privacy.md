<!--
Source of the page published at https://greenpulse.fit/privacy. The website lives
outside this repo; this file is what it is built from, so edit it here and
republish rather than editing the page directly.

Derived from docs/legal/data-inventory.md - change that first when the app starts
storing something new. NOT YET REVIEWED BY A LAWYER. Written for the Privacy Act
1988 (Cth) and the Australian Privacy Principles; the operator is in New South
Wales. The open questions a review has to settle are listed at the end of the
data inventory.
-->

# GreenPulse Privacy Policy

**Last updated: 15 September 2026**

GreenPulse is a workout tracker for personal trainers and the people they coach. A trainer writes
workouts, assigns them to clients, and reviews the sessions those clients perform.

This policy explains what personal information we hold, why, who can see it, and what you can ask us
to do about it. It is written to be read, not to be survived. If anything in it is unclear, ask —
**privacy@greenpulse.fit**.

## Who we are

GreenPulse is operated by **Zephyr Rosin, trading as GreenPulse** ("we", "us"), New South Wales,
Australia.

We handle personal information in accordance with the **Privacy Act 1988 (Cth)** and the
**Australian Privacy Principles** (APPs). For questions, requests about your information, or anything
in this policy: **privacy@greenpulse.fit**.

## Your trainer and us

Two parties are involved in your training records, and it helps to know which does what.

**Your trainer** decides what to record about you and why — which workouts to prescribe, what loads
to target, what to review. Many trainers have privacy obligations of their own, separate from ours,
because they collect health information about the people they coach.

**We** provide the tool: we store your records, show them to the people the app is built to show
them to, and protect them. We are responsible for how GreenPulse itself handles your information, and
you can always come to us directly — you do not need to go through your trainer first.

## Health information

Sessions, sets, loads, durations, session notes and progress photos are **health information**, which
the Privacy Act treats as **sensitive information**. We only collect it with your consent, and we
treat it with the extra care that requires.

You give that consent when you register, on the registration screen, which links to this policy
before you create an account. You can withdraw it at any time by deleting your account
(Profile → Delete my account) or by emailing us. Withdrawing it means we stop holding your training
records — we cannot run a training record without them.

We collect only what the app needs to work, and we collect it from you or from your trainer. We do
not buy information about you, and we do not combine it with information from anywhere else.

You cannot use GreenPulse anonymously or under a pseudonym: it links a client to a specific trainer,
and that is not practicable without knowing who each of you is.

## What we hold

### Your account
Your name, email address, and whether you are a trainer or a client. If you are a client, which
trainer you are linked to. If you are a trainer, your invite code. The date you registered, and
whether you have verified your email address. Your password is never stored by us in a readable
form; it is held as a salted hash by Google Firebase.

**Any other signed-in GreenPulse user is technically able to read the name, email address, role,
trainer link and trainer invite code of every account.** We are telling you this because it is true
rather than because it is comfortable. Registration works by looking a trainer up by their invite
code, and the database's permission rules currently grant that lookup by opening this information to
every signed-in account. The app itself never shows anyone a list of other users, and nothing about
anyone's training is exposed this way. We intend to narrow it, and will update this section when we
have.

### Your training
Every session you record — the exercises, the sets, the weights, reps, distances and durations, how
long it took, the date, and any notes you type. The workout plans you or your trainer wrote, the
versions of those plans, and the target loads set for you.

When you finish a session that your trainer prescribed, the app compares it with the plan and labels
it **As Prescribed** or **Modified**, noting what differed. That is an automatic comparison, used as a
record for you and your trainer. It is not a decision about you, and nothing is decided on the
strength of it.

**Who can read it:** you, and the one trainer you are linked to. Nobody else — not other trainers,
not other clients. This is enforced by the database's own permission rules, not just by what the app
chooses to show.

### Messages and progress media
GreenPulse can carry messages between a client and their trainer, and photos or videos a client
uploads to track progress. **Both features are currently switched off in the app**, so nothing new is
being recorded through them. The capability and the permission rules remain in place, and anything
recorded before they were switched off is still stored, so this policy describes them.

Where they are in use: messages are readable only by the two people in the conversation, and cannot
be edited or deleted once sent — like a sent email. Progress media is readable only by the client who
uploaded it and their trainer, and the client can delete it at any time.

### Technical information
When you use the web app, our host records ordinary web-server logs — IP address, browser, and which
pages were requested. Firebase records the IP address of sign-in attempts as part of protecting
accounts from abuse. If crash reporting is enabled on the build you are using, a crash sends us the
error, a stack trace, your app version and your platform — no name, no email, no IP address. A stack
trace can occasionally include an internal record ID, which is why we say "no identity" rather than
"anonymous".

### What we do not do
No advertising. No analytics SDK. No tracking you across other apps or websites. No direct marketing.
No selling or trading your information, and no sharing it with anyone for their own purposes. We do
not knowingly collect information from anyone under 16; if a trainer coaches a minor, that trainer is
responsible for the consent required and should contact us first.

## Why we hold it

To run GreenPulse: to give you an account, to let your trainer prescribe your workouts and review
your sessions, to let you record them, to keep accounts secure, and to find and fix faults. We do not
use your information for any other purpose unless you agree, or the law requires or allows it.

## Who we share it with

Only the services that make the app work, each handling information on our behalf:

- **Google (Firebase)** — authentication, database and file storage. Everything described above is
  stored on Google's infrastructure.
- **Cloudflare** — serves the web app and keeps standard request logs.
- **Sentry** — crash reports, when enabled. Errors and stack traces only.
- **YouTube (Google)** — exercise how-to videos are embedded rather than hosted by us. When a video
  player loads, Google receives your IP address and which video was requested. On the web app we use
  YouTube's privacy-enhanced player, which does not set tracking cookies unless you play the video. In
  the iPhone and Android apps the player loads from YouTube directly, which may set cookies or similar
  identifiers as soon as it loads. What Google does with this is covered by
  [Google's own privacy policy](https://policies.google.com/privacy). We receive nothing from it.

We will also disclose information where Australian law requires or authorises it.

### Where your information is stored

**Your training records stay in Australia.** The GreenPulse database — your profile, sessions, sets,
plans, targets and notes — is hosted by Google in its Sydney region.

Some information is handled outside Australia, most likely in **the United States** and other
countries where these providers operate:

- your **sign-in record** (email address, password hash, sign-in times and IP addresses), which
  Google Firebase Authentication holds globally;
- **crash reports**, when enabled, held by Sentry;
- **web request logs**, kept by Cloudflare wherever the request is served; and
- what **YouTube** receives when a video player loads.

We choose providers that protect information to a standard comparable to the Australian Privacy
Principles, and we remain accountable to you for how they handle it on our behalf.

## How long we keep it

Your account and your training records are kept for as long as your account exists. Delete your
account and we delete what we hold about you, subject to the limits described immediately below.

## Deleting your account

Open the app, go to **Profile → Delete my account**, and confirm with your password. This is
irreversible.

**What it removes:** your sign-in, your profile, every session you have logged and the sets in them,
any progress media you uploaded and the files behind it, and any custom exercises you created.

**What it cannot remove, and why.** GreenPulse has no server of its own; the app deletes data as
you, under the same permission rules that protect it. Some records are deliberately undeletable
because other people's records depend on them:

- **Workout plans and their versions.** Every session points at the exact version of the plan it was
  performed against. Deleting a plan would make other people's history unreadable, so the rules
  refuse it.
- **Assignments** — the record that a trainer prescribed you a plan, for the same reason.
- **Messages you sent**, which remain in the recipient's conversation, as a sent email does.
- **Comments** a trainer left on your progress media.

None of these carries your name or email once your profile is gone. If you want them erased as well,
email **privacy@greenpulse.fit** and we will do it by hand. We will confirm when it is done.

**Trainers:** if you still have clients linked to you, the app will not let you delete yet. Your
clients' accounts point at yours, and nothing in the app can re-point them afterwards, so deleting
would strand them. Move your clients to another trainer first, or email us and we will handle it.

You can also delete your account without the app: email **privacy@greenpulse.fit** from the address
you registered with and we will delete it and confirm.

## Accessing and correcting your information

You can ask us for a copy of the personal information we hold about you, and ask us to correct
anything that is inaccurate, out of date, incomplete or misleading. Email
**privacy@greenpulse.fit**. We will respond within **30 days**, and there is no charge.

We will give you your training records in a form you can use elsewhere if you ask. If the law allows
us to refuse a request, or part of one, we will tell you why in writing and how to complain about it.

The app does not yet let you edit your name, your email address, or a session once it is finished, so
for any of those, ask us.

## Complaints

If you think we have mishandled your personal information, email **privacy@greenpulse.fit** and tell
us what happened. We will acknowledge your complaint promptly and give you a response within **30
days**.

If you are not satisfied with our response, you can complain to the **Office of the Australian
Information Commissioner** at [oaic.gov.au](https://www.oaic.gov.au/privacy/privacy-complaints) or
on 1300 363 992. The OAIC will generally expect you to have raised it with us first.

## Security

Information is encrypted in transit and at rest by Google's infrastructure. Access is enforced by
database permission rules rather than only by the app, so an unauthorised read of your training
records fails at the database even if somebody bypasses the interface. Passwords are hashed by
Firebase and are never visible to us.

No system is perfectly secure. If we become aware of a data breach that is likely to result in
serious harm to you, we will notify you and the Office of the Australian Information Commissioner as
soon as practicable, as the Notifiable Data Breaches scheme requires.

## If you are outside Australia

GreenPulse is operated from Australia and this policy is written for Australian privacy law. If you
live somewhere with its own data protection law — the United Kingdom or the European Union, for
example — you may have additional rights under it. Email us and we will honour them.

## Changes

We will update this page when the app changes, and change the date at the top. Where a change
materially affects you we will tell you in the app or by email before it takes effect.

## Contact

**privacy@greenpulse.fit** — Zephyr Rosin, trading as GreenPulse, New South Wales, Australia.
