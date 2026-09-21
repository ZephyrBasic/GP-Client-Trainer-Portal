import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { enableNetwork, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

// How long we wait for a listener's *first* callback before deciding the
// backend is unreachable. 10s matches Firestore's own connectivity watchdog, so
// we never announce a problem before the SDK itself has concluded one. One
// number is used everywhere - including AuthContext, which imports this - so
// the auth gate and the screen underneath it can never disagree about whether
// we are offline.
export const SNAPSHOT_TIMEOUT_MS = 10000

// How long a listener the server *has* answered may sit on cache-only answers
// before we call it offline. Shorter than the opening watchdog - by then the
// SDK has usually already decided the stream is down - but long enough to ride
// out the brief fromCache flip a stream reconnect produces.
export const RECONNECT_GRACE_MS = 3000

// Every Firestore read in the app funnels through here. That is partly the
// repo's existing "one hook, one onSnapshot, returns { data, loading }"
// convention factored out of thirteen copies, and partly a down payment on the
// eventual move to @react-native-firebase: its listener API is close enough
// (`onSnapshot(onNext, onError)`) that swapping SDKs should mean editing this
// file rather than every hook and screen.
//
// The bug this exists to kill: `onSnapshot` with no error callback and no
// timeout can leave a `loading` flag true forever, which renders as a permanent
// spinner and reads to the user as "the app is broken" rather than "the network
// is down". Two distinct failures produce it, and they need different fixes:
//
//   (A) the listener errors - rules reject it, the token expires. Firestore
//       *does* invoke the error callback, so an error callback is the fix.
//   (B) the device cannot reach the backend. Firestore invokes *nothing* while
//       it is still trying: it queues the listener and waits for a connection.
//       Error callbacks do not help. Only a timeout does.
//   (C) Firestore gives up connecting and answers from its local cache, which
//       on a cold start is empty. `onNext` fires *successfully* with a valid
//       "this document does not exist" / "this collection has no documents".
//
// (C) is the nastiest and was found by testing rather than reasoning: pointed at
// a black-holed backend, the profile listener came back at 11s with
// `exists = false, fromCache = true`. It cancels the timeout - we did get data -
// runs no error callback, and renders a confident empty state. Worse than the
// original bug, which at least showed a spinner you could tell was stuck.
//
// So the offline signal is `snapshot.metadata.fromCache`: it says this answer
// did not come from the server, which is exactly the question. That still means
// watching what the *data* does rather than asking the OS about the network -
// during the outage that prompted this work the phone was fully "connected"
// (wifi associated, raw-IP HTTPS completing in ~350ms) with only DNS broken, so
// any connectivity library would have reported online while every request
// timed out.
//
// `includeMetadataChanges: true` is required for recovery, not for detection:
// when the connection returns and the server confirms data we already had,
// nothing about the documents changes - only `fromCache` flips. Without it that
// callback is suppressed and the banner would stay up until the data next
// happened to change.
//
// Note what this cannot do: show stale data while offline. The Firebase JS SDK
// caches to IndexedDB, React Native has no IndexedDB, and the SDK silently
// downgrades to a memory-only cache that dies with the app (verified against
// firebase@12.16.0; see .claude/docs/offline-resilience.md). So there is no
// yesterday's-workout to fall back on. Everything here is about reaching a
// screen and being honest about why it is empty. Real offline data is what the
// @react-native-firebase migration buys.

type SnapshotOptions = {
    // Key the document id is written under. Defaults to `id`; user documents
    // use `uid` because that name is load-bearing at the call sites (it is the
    // auth uid, and getChatId takes it as such).
    idKey?: string
    // Applied when a snapshot arrives rather than on every render, matching the
    // hooks this replaces. Sorting stays client-side on purpose so we don't
    // need composite indexes - see firestore.indexes.json, deliberately near-empty.
    sort?: (a: any, b: any) => number
    timeoutMs?: number
}

type SnapshotState<T> = {
    data: T
    loading: boolean
    // True only when we believe the *backend is unreachable* - the timeout
    // elapsed with no callback, or Firestore reported `unavailable`. A rules
    // rejection is not offline, and labelling it as such would send the user to
    // check their wifi over a permissions bug.
    offline: boolean
    error: any
    retry: () => void
}

const useFirestoreListener = <T,>(
    buildRef: () => any,
    deps: unknown[],
    emptyValue: T,
    toData: (snapshot: any) => T,
    timeoutMs: number
): SnapshotState<T> => {
    const [data, setData] = useState<T>(emptyValue)
    const [loading, setLoading] = useState(true)
    const [offline, setOffline] = useState(false)
    const [error, setError] = useState<any>(null)
    const [attempt, setAttempt] = useState(0)

    // buildRef and toData are fresh closures on every render, so they can't go
    // in the dependency array without resubscribing constantly. The caller's
    // `deps` decide when to resubscribe; these refs just keep the latest
    // closures reachable so we never build a query from stale props.
    const buildRefLatest = useRef(buildRef)
    const toDataLatest = useRef(toData)
    buildRefLatest.current = buildRef
    toDataLatest.current = toData

    // `loading` above is set by the effect, which runs after the render where
    // the deps change - so a read whose id has only just become known (a
    // Version once its Template names it, a Template once its Assignment does)
    // reports "not loading, no data" for exactly that one render. Every screen
    // that trusts the pair then paints its "isn't available" copy for a frame
    // before its spinner, which is the message that appears and vanishes. So
    // the render itself knows: new deps that will subscribe are loading until
    // the effect has taken them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const depsToken = useMemo(() => ({}), deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const willSubscribe = useMemo(() => Boolean(buildRefLatest.current()), deps)
    const subscribedToken = useRef<object | null>(null)

    useEffect(() => {
        subscribedToken.current = depsToken
        const ref = buildRefLatest.current()

        // Reset rather than linger when the id argument goes null (signed out,
        // route param not resolved yet), matching the hooks this replaces.
        if (!ref) {
            setData(emptyValue)
            setLoading(false)
            setOffline(false)
            setError(null)
            return
        }

        setLoading(true)
        setOffline(false)
        setError(null)

        // Release the gate, but deliberately do NOT unsubscribe. The listener
        // stays queued, so if the connection comes back at 30s the data still
        // arrives, renders, and clears `offline` on its own. Recovery is
        // automatic; `retry` below is for reassurance, not correctness.
        const goOffline = () => {
            timer = null
            setOffline(true)
            setLoading(false)
        }
        let timer: ReturnType<typeof setTimeout> | null = setTimeout(goOffline, timeoutMs)

        const unsubscribe = onSnapshot(
            ref,
            { includeMetadataChanges: true },
            (snapshot: any) => {
                const next = toDataLatest.current(snapshot)
                setData(next)
                setError(null)

                if (snapshot.metadata?.fromCache !== true) {
                    if (timer) clearTimeout(timer)
                    timer = null
                    setLoading(false)
                    setOffline(false)
                    return
                }

                // A cache-backed answer is not an answer - but it is not an
                // outage either, not yet. Firestore answers from cache first
                // whenever another listener already holds some of these
                // documents, and the server confirms a few hundred ms later;
                // raising the banner on that first delivery is what drew a
                // "can't reach the server" that vanished a second later on
                // nearly every screen. So a cache answer only arms the same
                // watchdog the subscription opened with (or a short one, if
                // the server had already answered and this is the connection
                // dropping), and the banner goes up only if the server stays
                // silent past it - case (C) above still lands there.
                //
                // Rendered straight away when it has something in it, since it
                // may be the last good data. An empty one keeps `loading`:
                // "you have no sessions" from a cache that has simply not been
                // filled is the confident wrong empty state from case (C),
                // shown for a second instead of for good.
                const empty = Array.isArray(next) ? next.length === 0 : next == null
                if (!empty) setLoading(false)
                if (!timer) timer = setTimeout(goOffline, RECONNECT_GRACE_MS)
            },
            (err: any) => {
                if (timer) clearTimeout(timer)
                timer = null
                console.warn('[firestore] listener failed:', err)
                // Last good data is kept on purpose. A dropped connection must
                // never blank out what is already on screen.
                setError(err)
                setOffline(err?.code === 'unavailable')
                setLoading(false)
            }
        )

        return () => {
            if (timer) clearTimeout(timer)
            unsubscribe()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, attempt, timeoutMs])

    // Resubscribes and re-arms the timeout, so the user gets a fresh attempt
    // and visible feedback. enableNetwork is a nudge for the case where the SDK
    // has put itself in an offline state; it resolves harmlessly otherwise.
    const retry = useCallback(() => {
        enableNetwork(db).catch(() => {})
        setAttempt((n) => n + 1)
    }, [])

    const pending = willSubscribe && subscribedToken.current !== depsToken
    return { data, loading: loading || pending, offline, error, retry }
}

// A collection query. `data` is always an array - empty, never null - so
// callers can map over it without guarding.
export const useFirestoreQuery = (
    buildQuery: () => any,
    deps: unknown[],
    { idKey = 'id', sort, timeoutMs = SNAPSHOT_TIMEOUT_MS }: SnapshotOptions = {}
) => {
    const sortLatest = useRef(sort)
    sortLatest.current = sort

    return useFirestoreListener<any[]>(
        buildQuery,
        deps,
        [],
        (snapshot) => {
            const rows = snapshot.docs.map((docSnap: any): any => ({
                [idKey]: docSnap.id,
                ...docSnap.data(),
            }))
            if (sortLatest.current) rows.sort(sortLatest.current)
            return rows
        },
        timeoutMs
    )
}

// A single document. `data` is the document or null if it doesn't exist.
export const useFirestoreDoc = (
    buildDoc: () => any,
    deps: unknown[],
    { idKey = 'id', timeoutMs = SNAPSHOT_TIMEOUT_MS }: SnapshotOptions = {}
) =>
    useFirestoreListener<any>(
        buildDoc,
        deps,
        null,
        (snapshot) => (snapshot.exists() ? { [idKey]: snapshot.id, ...snapshot.data() } : null),
        timeoutMs
    )
