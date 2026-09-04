import type { SetField } from '../types/exercise'
import type { ExerciseWithSets, StoredSet } from './setDraft'

// The one place prescription is reasoned about.
//
// Everything this feature knows about turning "what the Trainer wrote" plus
// "what the Trainer wrote for *you*" into "what this Client should see" lives
// here, and screens import it rather than working it out themselves. That is not
// tidiness: ADR 0004's rule - a progression wins on the Exercises it changed, a
// Client's own numbers survive on the ones it left alone - is subtle enough that
// a second implementation would drift from the first, and the two would disagree
// about what a Client was asked to do.
//
// Pure by construction: plain data in, plain data out, no React, no Firestore,
// no React Native runtime. There is no test runner in this repo (see the spec's
// Testing Decisions), so being able to reason about this module - and to test it
// later without mounting a component or authenticating - is the whole point of
// putting the boundary here.
//
// Two operations, and the second is the mirror of the first: resolveTargets says
// what this Client was asked to do, and compareSession says whether they did it.
// They share their internals deliberately - a comparison that read a measurement
// differently from the resolver that prefilled it would judge a Client against
// numbers they were never shown.

/**
 * One Client's own targets for one Exercise, as stored on their Assignment.
 *
 * `sets` is what that Client sees. The other two fields are what makes ADR
 * 0004's rule computable at read time rather than by fanning writes out of a
 * publish (there is no server to do that, and read-time resolution is the only
 * version that is correct offline):
 *
 * - `versionId` names the Template Version this was recorded against. Not the
 *   Version before the current one - a Client's override may be several
 *   progressions old, and judging it against the immediate predecessor would
 *   keep an override the Trainer had already overwritten two Versions ago.
 * - `basis` is what that Version asked for on this Exercise at the moment the
 *   override was set. Stored rather than re-read, because the rule is
 *   per-Exercise ("did *this* Exercise change?") and answering it from the
 *   versionId alone would mean fetching an arbitrary number of old Versions -
 *   in a gym basement, at the moment a Client taps start.
 *
 * `versionId` still earns its place beside `basis`: when it equals the Version
 * being resolved, nothing can have changed and no comparison is needed at all.
 */
export type TargetOverride = {
    versionId: string
    basis: StoredSet[]
    sets: StoredSet[]
}

/**
 * A Client's overrides, keyed by Exercise.
 *
 * One additional field on the Assignment document; absent means "no overrides",
 * which is why ticket 06 could leave it unwritten without a migration.
 *
 * Keyed by exerciseId rather than by position, so a Trainer reordering a
 * Template doesn't shuffle a Client's loads onto the wrong movements. A Template
 * that prescribes the same Exercise twice therefore gets one override for both
 * occurrences, which is the honest reading of "this Client's load for this
 * movement".
 */
export type TargetOverrides = Record<string, TargetOverride>

/**
 * A Template Version, as much of one as resolution needs.
 *
 * Deliberately structural rather than the hook's document type: this module must
 * not import from `hooks/` or `firebase/`, and a caller holding a plain object
 * is exactly what makes it testable without Firestore. `id` is the Version's
 * document id, which `useTemplateVersion` puts on the row.
 */
export type ResolvableVersion = {
    id?: string
    exercises?: ExerciseWithSets[]
} | null | undefined

/** An Assignment, as much of one as resolution needs. */
export type ResolvableAssignment = {
    targetOverrides?: TargetOverrides
} | null | undefined

const NO_OVERRIDES: TargetOverrides = {}

/**
 * One measurement, read without ever inventing a number.
 *
 * `?? null` and not `|| 0`: a measurement the Trainer left blank is null and
 * must stay null through resolution, because "no weight" and "lifted 0 kg" are
 * different facts and a plank has no weight at all. A stored 0 survives as 0 for
 * the same reason.
 */
const measurementOf = (set: StoredSet | undefined, field: SetField): number | null =>
    set?.[field] ?? null

/**
 * Projects a stored Set onto the measurements an Exercise declares.
 *
 * The Version's Exercise is the authority on which measurements exist - it
 * denormalises them from the catalog - so an override written before a retag
 * cannot smuggle in a measurement the Exercise no longer takes, and a
 * measurement it gained appears as a blank rather than being missing.
 */
const setFor = (set: StoredSet, fields: SetField[]): StoredSet =>
    (fields ?? []).reduce((acc, field) => {
        acc[field] = measurementOf(set, field)
        return acc
    }, {} as StoredSet)

/** Whether two lists of Sets say the same thing, measurement by measurement. */
const setsMatch = (a: StoredSet[], b: StoredSet[], fields: SetField[]): boolean =>
    a.length === b.length &&
    a.every((set, i) => (fields ?? []).every((field) => measurementOf(set, field) === measurementOf(b[i], field)))

/**
 * The targets one Client should see for one Template Version.
 *
 * The Version supplies the plan - which Exercises, in what order, with how many
 * Sets - and the Assignment supplies that Client's own numbers on top. Two
 * Clients on the same Template get two different answers from the same Version,
 * which is the entire reason an Assignment is a record rather than a list of
 * names (ADR 0004).
 *
 * The Version's own Exercises are the spine: an override for an Exercise this
 * Version doesn't prescribe is simply inert, so a Trainer dropping a movement
 * drops it for everyone without having to clean up anyone's Assignment.
 *
 * An override does not survive a progression that touched its own Exercise -
 * ADR 0004's other half, decided below and nowhere else.
 */
export const resolveTargets = (
    version: ResolvableVersion,
    assignment: ResolvableAssignment
): ExerciseWithSets[] => {
    const overrides = assignment?.targetOverrides ?? NO_OVERRIDES

    return (version?.exercises ?? []).map((exercise) => {
        const override = overrides[exercise.exerciseId]

        // An override with no Sets is not a quieter override, it is no override:
        // a Trainer who cleared one back to the Template's numbers gets the
        // Template's numbers.
        if (!override || !Array.isArray(override.sets) || override.sets.length === 0) return exercise

        // ADR 0004, and the whole of it: a progression wins on the Exercises it
        // changed, and a Client's own numbers survive on the ones it left alone.
        // Asked per-Exercise, so an edit to the bench press cannot quietly wipe
        // this Client's squat.
        //
        // Answered from the Assignment alone. `basis` is what the Version this
        // override was set against asked for *here*, so nothing is fetched and
        // the answer is the same in a gym basement as on wifi. It is also not
        // the immediately preceding Version: an override may be several
        // progressions old, and judging it against the one just before this
        // would keep an override the Trainer had already overwritten two
        // Versions ago.
        //
        // Two ways to keep it, and one of them is free: an override recorded
        // against the very Version being resolved cannot have been progressed
        // past, so no comparison is needed. Otherwise the basis has to still say
        // what this Version says.
        //
        // An override that cannot produce a basis loses. Being unable to tell
        // whether it is stale is precisely the silent progression failure this
        // rule exists to prevent, and the write side already refuses to mint
        // one, so any such override is damage rather than intent.
        const unchanged =
            (!!version?.id && override.versionId === version.id) ||
            (Array.isArray(override.basis) && setsMatch(override.basis, exercise.sets ?? [], exercise.fields))
        if (!unchanged) return exercise

        return { ...exercise, sets: override.sets.map((set) => setFor(set, exercise.fields)) }
    })
}

/**
 * How many Exercises this Client has their own numbers on.
 *
 * Only so a roster can say "3 exercises customised" without any screen having to
 * know what shape `targetOverrides` is - which is what keeps that shape this
 * module's business.
 *
 * Counts overrides as stored, not as they resolve: one a progression has made
 * stale still counts here although the Client no longer sees it. Saving that
 * Client's targets again is what clears it, since the form is seeded from what
 * resolves and an Exercise matching the Version stores nothing.
 */
export const overriddenExerciseCount = (assignment: ResolvableAssignment): number =>
    Object.keys(assignment?.targetOverrides ?? NO_OVERRIDES).length

/**
 * What to store on the Assignment, given the targets a Trainer just edited.
 *
 * The write side of the same rule, and here rather than in the screen for the
 * same reason as the read side: which Exercises count as overridden, and the
 * fact that every override records the Version it was set against, are one
 * decision that must be made once.
 *
 * An Exercise left exactly as the Version prescribes it stores nothing at all.
 * That keeps "no override" the normal state - so a Trainer who nudges a load and
 * then puts it back is genuinely back to the shared plan, rather than carrying
 * an override that happens to agree today and would survive a progression
 * tomorrow.
 *
 * `edited` is the Trainer's whole list in the same shape a Version holds, so the
 * screen can hand back what its editor produced without picking it apart.
 */
export const targetOverridesFrom = (
    version: ResolvableVersion,
    edited: ExerciseWithSets[]
): TargetOverrides => {
    // An override that cannot name the Version it was set against is worse than
    // no override: ticket 09 would have no way to tell whether it had gone
    // stale, so it would either outlive a progression that overwrote it or be
    // discarded on the next one at random. Refuse to mint one instead.
    if (!version?.id) return NO_OVERRIDES

    const prescribed: Record<string, ExerciseWithSets> = {}
    ;(version.exercises ?? []).forEach((exercise) => {
        if (!(exercise.exerciseId in prescribed)) prescribed[exercise.exerciseId] = exercise
    })

    return (edited ?? []).reduce((acc, exercise) => {
        const plan = prescribed[exercise.exerciseId]
        // Nothing to override, and nothing to record a basis against. Adding an
        // Exercise for one Client is editing the Template, not their loads.
        if (!plan) return acc

        const fields = plan.fields ?? []
        const sets = (exercise.sets ?? []).map((set) => setFor(set, fields))
        const basis = (plan.sets ?? []).map((set) => setFor(set, fields))
        if (setsMatch(sets, basis, fields)) return acc

        acc[exercise.exerciseId] = { versionId: version.id, basis, sets }
        return acc
    }, {} as TargetOverrides)
}

/**
 * Whether a Session did what was asked of it (ADR 0005, and CONTEXT.md's
 * "As Prescribed / Modified").
 *
 * Strict, with no tolerance band: one rep short or one kilo over is Modified.
 * Most Sessions will therefore be Modified, which is intended - the verdict
 * answers "is this worth opening?", not "was this good". The diff answers what
 * actually happened.
 *
 * Stored hyphenated rather than as the words a screen shows, so display strings
 * stay display; `verdictLabel` is the one place they are spelled.
 */
export type SessionVerdict = 'as-prescribed' | 'modified'

/**
 * What became of one Exercise, or of one Set inside it.
 *
 *   matched  performed exactly as prescribed
 *   changed  performed, but not as prescribed
 *   added    performed although never prescribed
 *   skipped  prescribed but not performed
 *
 * `skipped` is separate from `changed` on purpose. Only ticked Sets are stored
 * (ticket 07: every prescribed row arrives prefilled with its target, so
 * storing an unticked one would record work nobody did), which means a Set the
 * Client never ticked reaches this comparison as *absent* rather than as
 * different numbers. It is a deviation either way, but calling it a mismatch
 * would send a Trainer hunting for the numbers that changed when there are
 * none: the work simply wasn't done.
 */
export type DiffStatus = 'matched' | 'changed' | 'added' | 'skipped'

/** One Set, as asked for and as performed. */
export type SetDiff = {
    /** 1-based, so it reads as the Set number that was on the row. */
    set: number
    status: DiffStatus
    /** Null only when the Set was added. Absent measurements stay null, never 0. */
    target: StoredSet | null
    /** Null only when the Set was skipped. */
    performed: StoredSet | null
    /** Which measurements differ. Empty unless `status` is 'changed'. */
    changed: SetField[]
}

/** One Exercise's account of itself, Set by Set. */
export type ExerciseDiff = {
    exerciseId: string
    /**
     * Denormalised, as everywhere else this feature stores an Exercise, so a
     * diff still names its movements after the catalog is renamed or retagged.
     */
    name: string
    /** Which measurements the rows carry, in the order they were shown. */
    fields: SetField[]
    status: DiffStatus
    sets: SetDiff[]
}

/** The verdict and the itemisation that justifies it. */
export type SessionComparison = {
    verdict: SessionVerdict
    exercises: ExerciseDiff[]
}

/**
 * The words for a verdict, spelled once.
 *
 * Takes what a Session document carries - a string off an `any` row, or nothing
 * at all - and returns null for a Session that has no verdict, which is not the
 * same as one that failed: a Self-Directed Session was never judged because
 * there was nothing to judge it against.
 */
export const verdictLabel = (verdict?: string | null): string | null =>
    verdict === 'as-prescribed' ? 'As Prescribed' : verdict === 'modified' ? 'Modified' : null

/** The rows worth reading first: everything that is not a match. */
export const deviations = (diff?: ExerciseDiff[] | null): ExerciseDiff[] =>
    (diff ?? []).filter((exercise) => exercise.status !== 'matched')

/**
 * The measurements a comparison has to look at.
 *
 * The target's first, because that is the order the Client saw them in, plus
 * anything only the performed Set carries. An Exercise retagged between the
 * Version being written and the Session being performed would otherwise have a
 * measurement compared against nothing at all and silently pass.
 */
const comparedFields = (target?: SetField[], performed?: SetField[]): SetField[] => {
    const fields = target ?? []
    return [...fields, ...(performed ?? []).filter((field) => !fields.includes(field))]
}

/**
 * Pairs Sets by position and says what happened to each.
 *
 * Position is the only honest pairing: Sets are ordered within an Exercise and
 * the Client works down the rows, so the second Set performed answers the second
 * Set prescribed. It does mean a Client who skips a middle Set of a ramp shifts
 * the rows below it - the verdict is Modified either way, but the itemisation
 * then reads "set 2 changed, set 3 skipped" rather than "set 2 skipped".
 * Guessing which Set they meant to leave out would be a worse lie than
 * describing the rows in the order they arrived.
 *
 * Compared measurement by measurement through `measurementOf`, which is what
 * keeps an absent measurement absent: null === null, so a plank prescribed
 * without a weight and performed without one matches, where reading either as 0
 * would make them differ - or, worse, make an unloaded carry match a loaded one.
 */
const compareSets = (
    target: StoredSet[] | null | undefined,
    performed: StoredSet[] | null | undefined,
    fields: SetField[]
): SetDiff[] => {
    const prescribed = target ?? []
    const done = performed ?? []
    const rows = new Array(Math.max(prescribed.length, done.length)).fill(null)

    return rows.map((_, index): SetDiff => {
        const want = prescribed[index]
        const got = done[index]

        // Past what was asked for: extra work, which is a deviation but not a
        // failure to do anything.
        if (!want) {
            return { set: index + 1, status: 'added', target: null, performed: setFor(got, fields), changed: [] }
        }

        // Prescribed and never ticked. There is no performed Set to show
        // because there is no Set: nothing was recorded.
        if (!got) {
            return { set: index + 1, status: 'skipped', target: setFor(want, fields), performed: null, changed: [] }
        }

        const changed = fields.filter((field) => measurementOf(got, field) !== measurementOf(want, field))

        return {
            set: index + 1,
            status: changed.length > 0 ? 'changed' : 'matched',
            target: setFor(want, fields),
            performed: setFor(got, fields),
            changed,
        }
    })
}

/**
 * The verdict and the itemised diff for one performed Session.
 *
 * Judged against `targets` - what `resolveTargets` gave this Client for the
 * Version they ran - and deliberately never against the raw Version. A Client
 * with their own loads was asked to lift their numbers, so measuring them
 * against the shared Template would mark every customised Client as Modified
 * for doing exactly what was asked (ADR 0004).
 *
 * Takes performed Exercises rather than a Session document because at the moment
 * of judging there is no document to take: the verdict and the Session it judges
 * are one write (ADR 0002), and the performed Exercises are the whole of what
 * can deviate. Everything else a Session carries - its duration, its date, its
 * notes - was never prescribed, so there is nothing to compare it to.
 *
 * Returns null when there is nothing to compare against, and the caller then
 * writes no verdict at all rather than a neutral third value: a Self-Directed
 * Session was never asked anything, and a prescribed Session whose Version never
 * reached the phone is one where we cannot say. `[]` is a different answer - a
 * Version that prescribes nothing - so the two are deliberately not conflated,
 * and the caller passes null rather than an empty list when the read failed.
 *
 * Set by Set, never a subtraction of combined work volume. A Session of carries
 * and planks has no loaded volume at all by design (CONTEXT.md), and comparing
 * totals would read it as zero against zero and call every one of them As
 * Prescribed.
 */
export const compareSession = (
    performed: ExerciseWithSets[],
    targets: ExerciseWithSets[] | null | undefined
): SessionComparison | null => {
    if (!targets) return null

    // Consumed as they pair off, so a Template that prescribes the same Exercise
    // twice matches its two occurrences in order rather than both against the
    // first performed one.
    //
    // Paired by id rather than by position, which is what makes the order the
    // Client trained in irrelevant. Doing the squats before the deadlifts is not
    // a deviation - the prescribed work was done - and order-sensitivity would
    // also punish an artefact of the live screen, which appends a late-arriving
    // plan below whatever the Client had already recorded.
    const unpaired = [...(performed ?? [])]

    const exercises: ExerciseDiff[] = targets.map((target) => {
        const at = unpaired.findIndex((exercise) => exercise.exerciseId === target.exerciseId)
        const done = at === -1 ? null : unpaired.splice(at, 1)[0]
        const fields = comparedFields(target.fields, done?.fields)
        const sets = compareSets(target.sets, done?.sets, fields)

        return {
            exerciseId: target.exerciseId,
            name: target.name ?? done?.name ?? '',
            fields,
            // An Exercise with nothing performed against it was skipped whole -
            // which is how a prescribed Exercise the Client ticked nothing on
            // arrives here, since a row with no ticked Sets is not stored at
            // all. Nothing prescribed and nothing performed is a match, not a
            // skip: there was nothing to leave out.
            status:
                sets.length === 0
                    ? 'matched'
                    : !done || (done.sets ?? []).length === 0
                      ? 'skipped'
                      : sets.every((set) => set.status === 'matched')
                        ? 'matched'
                        : 'changed',
            sets,
        }
    })

    // Whatever is left was never prescribed. Listed after the plan rather than
    // in the order it was performed, so the diff reads down the workout the
    // Client was given and then says what else they did.
    unpaired.forEach((done) => {
        const fields = comparedFields(done.fields)
        exercises.push({
            exerciseId: done.exerciseId,
            name: done.name ?? '',
            fields,
            status: 'added',
            sets: compareSets(null, done.sets, fields),
        })
    })

    return {
        // ADR 0005 in one line: As Prescribed only if nothing deviated at all.
        verdict: exercises.every((exercise) => exercise.status === 'matched') ? 'as-prescribed' : 'modified',
        exercises,
    }
}
