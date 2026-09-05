#!/usr/bin/env python3
"""Harvests candidate how-to demos for every exercise in the catalog.

    python scripts/find-exercise-videos.py                 # only exercises with no videoUrl
    python scripts/find-exercise-videos.py --all            # re-harvest everything
    python scripts/find-exercise-videos.py --limit 20       # a quick sample
    python scripts/find-exercise-videos.py --workers 8

Writes constants/videoCandidates.json - a *staging* file, deliberately not the
catalog. Nothing reaches clients until promote-videos.js copies a chosen
candidate across, because no automated score can tell whether a clip actually
demonstrates the movement correctly. That judgement is Zeph's and his beta
testers', and this file is the queue they work through.

Python rather than plain .js like the rest of scripts/, because yt-dlp is a
Python library. Driving it in-process instead of shelling out per exercise is
what keeps a 317-exercise run in minutes. yt-dlp is also why this needs no API
key: search.list costs 100 quota units per call, so 317 exercises would be
31,700 against a 10,000/day free ceiling - three days of waiting for one pass.

Resumable: the output file is rewritten after every completed exercise, so an
interrupted or rate-limited run loses at most one search.
"""

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

try:
    from yt_dlp import YoutubeDL
except ImportError:
    sys.exit("yt-dlp is not installed. Run: python -m pip install --upgrade yt-dlp")

# Video and channel titles are full of emoji, and a Windows console defaults to
# cp1252, which raises on them mid-run. Replace rather than fail: losing a glyph
# from a progress line is nothing, losing a 300-search sweep is not.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "constants" / "exercises.json"
OUT = ROOT / "constants" / "videoCandidates.json"

# The house rule from scripts/videoSources.js. A candidate at or under this
# plays whole; a longer one needs a hand-authored clip window, so it ranks below.
#
# There is deliberately no minimum. The old rule floored candidates at 15s and
# penalised anything shorter as "too short to show the movement", which is not
# true - a calf raise is fully demonstrated in eight seconds. See docs/adr/0006.
DEMO_MAX = 60

# Beyond this a video is a lecture or a full workout, not a demo of one movement.
MAX_USABLE = 900

# Signals the video is instructional rather than entertainment or a workout log.
GOOD_TITLE = re.compile(
    r"\b(how to|howto|tutorial|technique|proper form|correct form|form|demo|"
    r"demonstration|guide|exercise|coaching cues?|step by step)\b", re.I)

# Signals it is something else wearing an exercise name.
BAD_TITLE = re.compile(
    r"\b(gone wrong|fail|fails|reaction|podcast|vlog|prank|challenge|"
    r"transformation|full workout|complete workout|workout routine|"
    r"day \d+|week \d+|ep\.?\s*\d+|episode|highlights|compilation|"
    r"asmr|mukbang|motivation|gym rat|edit|meme)\b", re.I)

STOP = {"the", "a", "an", "and", "or", "with", "to", "on", "in", "of", "for"}


def tag_values(exercise, facet):
    prefix = facet + ":"
    return [t[len(prefix):] for t in exercise.get("tags", []) if t.startswith(prefix)]


def tokens(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def words(text):
    """Content words only - the denominator when asking how much of a name matched."""
    return {w for w in tokens(text) if w not in STOP}


def expand(text):
    """Content words plus every adjacent pair glued together.

    The catalog writes a few movements as one word ("Pushup", "Deadbug") while
    YouTube titles almost always space them ("Push Up"). Ungued, those share no
    token at all, and the near-miss penalty then fires on "push" - which is how
    "Pushup" came to score 6 against a video titled "How to Do a Push Up".
    Gluing makes the comparison spelling-agnostic. Hyphenated names ("Chin-up")
    already tokenise into two words, so they never had the problem.
    """
    seq = tokens(text)
    return words(text) | {a + b for a, b in zip(seq, seq[1:])}


def name_match(name, title):
    """How much of `name` the title accounts for, 0..1, ignoring compound spelling."""
    core = words(name)
    if not core:
        return 0.0, set()

    title_expanded = expand(title)
    matched = {w for w in core if w in title_expanded}

    # The reverse direction: a spaced name against a glued title ("Chin-up" vs
    # "Chinup Tutorial"). A glued pair of ours appearing there covers both halves.
    seq = tokens(name)
    for a, b in zip(seq, seq[1:]):
        if a + b in title_expanded:
            matched |= {a, b} & core

    return len(matched) / len(core), matched


def alternate_queries(exercise):
    """Other ways to ask, for names the primary query fails on.

    The primary query trusts the catalog's name, which works for the 290 records
    named the way a demo would be titled. It fails on house shorthand ("FDRS",
    "Single-Arm Smith Machine Push Away") and on spellings YouTube does not use
    ("Shivasana" for Savasana). These add context the name alone lacks - the
    muscle it trains, the modality it belongs to - which is usually enough to
    land in the right neighbourhood even when the exact name is unsearchable.
    """
    name = exercise["name"]
    muscles = tag_values(exercise, "muscle")
    modality = tag_values(exercise, "modality")
    role = tag_values(exercise, "role")

    out = [f"{name} exercise technique"]
    if muscles:
        out.append(f"{name} {muscles[0].replace('-', ' ')} exercise")
    if modality:
        out.append(f"{name} {modality[0].replace('-', ' ')}")
    if role and role[0] in ("warmup", "cooldown", "prehab"):
        out.append(f"{name} {role[0]} routine")
    return out


def build_query(exercise):
    """Search text from the record's name plus the equipment it needs.

    The catalog spells names out in full ("Single-Arm Dumbbell Row"), which is
    already close to how a demo would be titled. Equipment is appended only when
    the name does not already imply it, so "Cable Chest Fly" finds cable footage
    while "Barbell Back Squat" is not padded into nonsense.
    """
    name = exercise["name"]
    have = words(name)
    extra = [
        eq.replace("-", " ") for eq in tag_values(exercise, "equipment")
        if eq not in ("bodyweight", "none") and not words(eq) & have
    ]
    return " ".join([name] + extra[:1] + ["how to"])


def edit_distance(a, b, cap=2):
    """Levenshtein, abandoned once it exceeds `cap` - only near-misses matter."""
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        if min(cur) > cap:
            return cap + 1
        prev = cur
    return prev[-1]


def score(candidate, exercise, channel_freq):
    """Rank a candidate. Higher is better; this only orders a human's queue."""
    title = candidate["title"] or ""
    duration = candidate["duration"]
    points = 0.0

    needed = words(exercise["name"])
    title_words = expand(title)

    # Does the title actually name this movement? The strongest single signal,
    # and the one that catches a search landing on a loosely related exercise.
    ratio, matched = name_match(exercise["name"], title)
    points += 45 * ratio
    if ratio < 0.5:
        points -= 25

    # The whole name appearing verbatim is about as good as this gets.
    if re.search(re.escape(exercise["name"].lower()), title.lower()):
        points += 20

    # A title carrying a word that is *almost* one of ours but not it is usually a
    # different exercise entirely - "Adduction Machine" outranking "Abduction
    # Machine" on the shared word "machine" is the case this exists for. Antonym
    # pairs in anatomy are often one letter apart, so near-misses are penalised
    # harder than plain absences.
    for want in (w for w in needed if len(w) >= 6 and w not in matched):
        if any(edit_distance(want, got) <= 2 for got in title_words if len(got) >= 6):
            points -= 35
        else:
            points -= 8

    if duration is None:
        points -= 25                              # live stream or premiere
    elif duration <= DEMO_MAX:
        points += 35                              # plays whole, no clip needed
    elif duration <= 180:
        points += 12                              # easy to find a minute inside
    elif duration <= MAX_USABLE:
        points -= 5                               # usable but needs hunting
    else:
        points -= 40

    if GOOD_TITLE.search(title):
        points += 15
    if BAD_TITLE.search(title):
        points -= 45

    # A channel that turns up across many of the 317 is probably an exercise
    # library rather than a one-off, which means a consistent look and a single
    # channel to vet instead of three hundred.
    points += min(12, 2.5 * channel_freq.get(candidate["channelId"], 0))

    return round(points, 1)


def search(query, count):
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "skip_download": True,
        "ignoreerrors": True,
        "socket_timeout": 30,
    }
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{count}:{query}", download=False)

    out = []
    for entry in (info or {}).get("entries") or []:
        if not entry or not entry.get("id"):
            continue

        # No Shorts detection here, deliberately. This used to read
        #     shorts = "/shorts/" in (entry.get("webpage_url") or "")
        # which never once evaluated true: under extract_flat, yt-dlp leaves
        # `webpage_url` as None and always reports `url` in watch?v= form,
        # whatever the video is. So `isShort` was permanently False, the +10
        # ranking bonus for a Short was dead code, and no /shorts/ link was ever
        # written - which is precisely why the catalog ended up with 308
        # full-length demos and a single hand-added Short.
        #
        # It was not worth repairing. Shorts turn out to be unreachable from
        # ytsearch at all: 0 of 63 under-60s candidates across three movements
        # were true Shorts, including from explicit "#shorts" queries, because
        # YouTube serves them in a separate search shelf the flat extractor does
        # not read. Length is what the house rule actually cares about, and
        # `duration` below is reliable and gets recorded. See docs/adr/0006.
        out.append({
            "videoId": entry["id"],
            "url": f"https://youtu.be/{entry['id']}",
            "title": entry.get("title"),
            "duration": entry.get("duration"),
            "channel": entry.get("channel") or entry.get("uploader"),
            "channelId": entry.get("channel_id"),
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="re-harvest exercises that already have a videoUrl")
    ap.add_argument("--limit", type=int, help="only process the first N exercises")
    ap.add_argument("--results", type=int, default=12, help="candidates to fetch per exercise")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--rescore", action="store_true",
                    help="re-rank the existing staging file without searching again")
    ap.add_argument("--boost", type=float, metavar="SCORE",
                    help="re-search exercises whose best candidate scores below SCORE, "
                         "using alternate query forms, and merge the results")
    args = ap.parse_args()

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    todo = catalog if args.all else [ex for ex in catalog if not ex.get("videoUrl")]
    if args.limit:
        todo = todo[:args.limit]

    # Resume: keep results for exercises already harvested in a previous run.
    results = {}
    if OUT.exists():
        try:
            results = {r["id"]: r for r in json.loads(OUT.read_text(encoding="utf-8"))["exercises"]}
        except Exception:
            results = {}
    # Ranking is cheap and pure, so tuning the scorer does not mean paying for 300
    # searches again - the candidates are already on disk.
    if args.rescore:
        if not results:
            sys.exit("Nothing to rescore - no constants/videoCandidates.json yet.")
        todo = []
    elif args.boost is not None:
        if not results:
            sys.exit("Nothing to boost - run a normal harvest first.")
        # Existing candidates are kept and merged with the new ones rather than
        # replaced: the primary query's results are not wrong, just not good
        # enough, and the best pick may still come from that first sweep.
        weak = [ex for ex in catalog
                if ex["id"] in results
                and max((c["score"] for c in results[ex["id"]]["candidates"]),
                        default=float("-inf")) < args.boost]
        print(f"{len(weak)} exercises below score {args.boost} to re-search", flush=True)
        todo = weak
    else:
        todo = [ex for ex in todo if ex["id"] not in results]
        print(f"{len(todo)} exercises to search ({len(results)} already harvested)", flush=True)
        if not todo:
            return

    lock = Lock()
    done = [0]

    # Seeded from what is already on disk so the channel-frequency signal is the
    # same whether a run searched everything or resumed part-way.
    channel_freq = {}
    for row in results.values():
        for c in row["candidates"]:
            if c.get("channelId"):
                channel_freq[c["channelId"]] = channel_freq.get(c["channelId"], 0) + 1

    def harvest(exercise, queries=None, keep=None):
        queries = queries or [build_query(exercise)]
        found, errors = list(keep or []), []

        for query in queries:
            try:
                found += search(query, args.results)
            except Exception as exc:
                errors.append(str(exc)[:120])

        with lock:
            for c in found:
                if c["channelId"]:
                    channel_freq[c["channelId"]] = channel_freq.get(c["channelId"], 0) + 1
            done[0] += 1
            print(f"  [{done[0]}/{len(todo)}] {exercise['id']}: {len(found)} found", flush=True)

        return {"id": exercise["id"], "name": exercise["name"], "query": " | ".join(queries),
                "error": "; ".join(errors) or None, "candidates": found}

    by_id = {ex["id"]: ex for ex in catalog}

    def flush():
        """Rewrite the staging file from whatever has completed so far.

        Scoring is redone here rather than in the worker because two of the
        signals - channel frequency, and therefore the whole ranking - are only
        knowable once every search is in. Cheap enough to repeat per checkpoint,
        and it means an interrupted run leaves a correctly ranked partial file
        rather than a raw one.
        """
        for row in results.values():
            exercise = by_id.get(row["id"])
            if not exercise:
                continue
            seen, unique = set(), []
            for c in row["candidates"]:
                if c["videoId"] in seen:
                    continue
                seen.add(c["videoId"])
                c["score"] = score(c, exercise, channel_freq)
                c["fitsWindow"] = c["duration"] is not None and 0 < c["duration"] <= DEMO_MAX
                unique.append(c)
            row["candidates"] = sorted(unique, key=lambda c: -c["score"])

        ordered = [results[ex["id"]] for ex in catalog if ex["id"] in results]
        # Written via a temp file and swapped in, so an interrupt during the write
        # cannot leave truncated JSON that the next run then fails to resume from.
        tmp = OUT.with_suffix(".json.tmp")
        tmp.write_text(json.dumps({
            "generatedBy": "scripts/find-exercise-videos.py",
            "demoMaxSeconds": DEMO_MAX,
            "note": "Staging only - unreviewed search results. Promote with scripts/promote-videos.js.",
            "exercises": ordered,
        }, indent=2) + "\n", encoding="utf-8")
        tmp.replace(OUT)
        return ordered

    boosting = args.boost is not None

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [
            pool.submit(
                harvest, ex,
                alternate_queries(ex) if boosting else None,
                results[ex["id"]]["candidates"] if boosting else None,
            )
            for ex in todo
        ]
        for future in as_completed(futures):
            row = future.result()
            with lock:
                results[row["id"]] = row
                flush()

    ordered = flush()

    with_any = sum(1 for r in ordered if r["candidates"])
    with_fit = sum(1 for r in ordered if any(c["fitsWindow"] for c in r["candidates"]))
    failed = [r["id"] for r in ordered if r["error"]]

    print(f"\n{len(ordered)} exercises written to {OUT.relative_to(ROOT)}")
    print(f"  with at least one candidate:      {with_any}")
    print(f"  with one at or under {DEMO_MAX}s:            {with_fit}")
    if failed:
        print(f"  searches that errored ({len(failed)}): {', '.join(failed[:10])}")
    top = sorted(channel_freq.items(), key=lambda kv: -kv[1])[:12]
    print("\nMost frequent channels (candidates for APPROVED_CHANNELS):")
    names = {c["channelId"]: c["channel"] for r in ordered for c in r["candidates"]}
    for cid, n in top:
        print(f"  {n:>4}  {names.get(cid, '?')}  {cid}")


if __name__ == "__main__":
    main()
