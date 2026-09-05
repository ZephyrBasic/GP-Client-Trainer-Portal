# 6. How-to demos are measured, not guessed

Date: 2026-09-04

## Status

Accepted.

## Context

Every how-to demo in `constants/exercises.json` is a borrowed YouTube video. Two
rules governed which ones were acceptable, and neither was enforceable:

**The length rule was `15-45s`, and could not be checked offline.** The only
signal available without a YouTube API key was whether the link said
`/shorts/`. YouTube caps a Short at three *minutes*, so a 2m50s video satisfied
every check the repo could run. The one Short in the catalog turned out to run
82 seconds — over even the new, more generous rule — and nothing had ever
noticed.

**The lower bound was wrong.** The harvester penalised anything under 15s as
"too short to show the movement". A calf raise is fully demonstrated in eight
seconds. The floor rejected the tightest clips on a guess about length standing
in for a judgement about content.

**The harvester's Shorts detection had never worked.** It read

```python
shorts = "/shorts/" in (entry.get("webpage_url") or "")
```

but under `extract_flat` yt-dlp leaves `webpage_url` as `None` and always
reports `url` in `watch?v=` form. `isShort` was therefore permanently `False`,
the `+10` ranking bonus for a Short was dead code, and no `/shorts/` link was
ever written. This is the direct cause of the catalog's shape: 308 full-length
demos and a single hand-added Short.

Re-harvesting "as Shorts" was the obvious fix, and it does not work either.
Across three movements, 0 of 63 candidates under 60 seconds were true Shorts,
including from explicit `#shorts` queries: YouTube serves Shorts in a separate
search shelf that yt-dlp's flat extractor never reads. Shorts are reachable by
enumerating a channel's `/shorts` tab, but not by search.

## Decision

**Record the real duration.** Records carry `durationSeconds`, written from what
yt-dlp already learns during a harvest and previously discarded. Length is now
checked against the actual number, offline, with no API key.

**The house rule is a ceiling only: 60 seconds, no minimum.** Measured on
*effective* length — a clip window's span if the record has one, the video's
full duration if not. `scripts/videoSources.js` owns it as `DEMO_SECONDS`, and
`effectiveSeconds()` is shared so the validator, the verifier and the review
tool cannot disagree about how long a demo is.

**Shortness is not a proxy for quality, and is not required.** We harvest by
duration, not by Shorts-ness. A vertical phone-shaped clip is nicer, but it is
not worth a channel-curation pipeline for footage that phase 2 replaces with our
own.

**A person decides whether a demo is any good.** `scripts/review-catalog.js`
serves a local page that plays each demo, offers the ranked alternatives the
harvest found, and writes the verdict straight into the catalog. Scripts rank;
they do not choose.

## Consequences

`durationSeconds` is a seventh key in a schema that rejects any eighth, so it is
declared in three places that must agree: `scripts/validate-exercises.js`,
`types/exercise.ts`, and this file.

Its absence means *unknown length*, never zero and never a pass. The 309 records
harvested before it existed are reported as unknown by `verify-videos.js --long`
until they go through the review, which is an honest worklist rather than the
old silent guess.

A demo over 60s with no clip window now fails `validate-exercises.js`, and so
fails the commit gate. That is deliberate: it is the first check that could
ever have caught a too-long demo at all. 27 records have no candidate under 60s,
almost all of them activities (`Run`, `Swim`) or multi-movement routines
(`Vinyasa Flow`) rather than single movements — for those the right answer is
usually no demo at all, not a trimmed one.

`isShortsUrl()` survives but no longer means anything about length. Do not
restore it as a length check, and do not restore the 15-second floor.
