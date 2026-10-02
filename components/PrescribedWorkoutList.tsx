import { View } from 'react-native'

import ThemedText from './ThemedText'
import ThemedCard from './ThemedCard'
import { PlaceholderRows } from './Placeholder'
import ProgressSegments from './ProgressSegments'
import WorkoutSection from './WorkoutSection'
import WorkoutStartRow from './WorkoutStartRow'
import { Space } from '../constants/Layout'
import { useWorkoutTemplate } from '../hooks/useWorkoutTemplates'

/**
 * The "n of m" a prescribed row shows on its right, with its own small
 * progress segments beneath it - the same figure the Today hero shows for
 * whichever Assignment is furthest behind, just smaller and per-row.
 *
 * Never amber. Amber means Modified and nothing else (UI review, issue 14):
 * drawing "0 of 2" in it on a Tuesday told a Client who was simply mid-week
 * that something was wrong. Plain until the week's target is met, then the
 * accent - this is ordering, not a deadline (ADR 0001).
 */
const WeekFigure = ({ done, target }: { done: number; target: number }) => {
    const met = done >= target

    return (
        <View style={{ alignItems: 'flex-end', gap: Space.xs }}>
            <ThemedText variant="small" tone={met ? 'accent' : 'muted'}>
                <ThemedText
                    variant="cardTitle"
                    tone={met ? 'accent' : 'title'}
                    style={{ fontVariant: ['tabular-nums'] }}
                >
                    {done}
                </ThemedText>{' '}
                of {target}
            </ThemedText>
            <ProgressSegments total={target} filled={Math.min(done, target)} style={{ width: Math.min(60, target * 15) }} />
        </View>
    )
}

/**
 * One prescribed Workout Template on a Client's list.
 *
 * The Assignment names a Template but says nothing about it, so the row reads
 * the Template itself - one document, live, through the usual snapshot helper -
 * which is also what keeps the name and exercise count current when the Trainer
 * publishes a new Version. It does not read the Version: the count is
 * denormalised onto the Template for exactly this reason, and the contents are
 * only needed once the Client starts the workout, which is the live screen's
 * read and not this one's. The same is true of a set count: nothing here reads
 * the Version to produce one, so the row says how many Exercises rather than
 * inventing a set total the Template does not carry.
 *
 * Starting hands the whole loaded Template back rather than an id, because the
 * Session has to cite the exact Version it ran (ADR 0002) and this row is what
 * holds the current pointer.
 *
 * A Client is allowed this read because their Assignment document exists; see
 * the workoutTemplates read rule.
 */
const PrescribedWorkoutRow = ({
    assignment,
    onStart,
    doneThisWeek,
    disabled,
}: {
    assignment: any
    onStart: (template: any) => void
    doneThisWeek?: number
    disabled?: boolean
}) => {
    const { template, loading } = useWorkoutTemplate(assignment.templateId)

    const exerciseCount = template?.currentVersionExerciseCount

    // The Template resolves a beat after the Assignment does, and on a bad
    // connection may not resolve at all. Say which of those it is rather than
    // rendering an anonymous empty card - the screen's offline banner covers the
    // assignment list, not this per-row read.
    if (!template) {
        if (loading) return <PlaceholderRows count={1} />
        return (
            <ThemedCard muted={true}>
                <ThemedText variant="meta" tone="muted">
                    This workout isn&apos;t available right now.
                </ThemedText>
            </ThemedCard>
        )
    }

    // A Template whose pointer hasn't arrived - or that somehow never got a first
    // Version - cannot be started, because there would be nothing to prefill and
    // no Version for the Session to cite. Showing it unstartable is better than
    // opening a live screen with an empty plan in it.
    const startable = Boolean(template.currentVersionId) && !disabled

    return (
        <WorkoutStartRow
            name={template.name}
            // The count is absent on Templates authored before it started being
            // recorded, so the clause drops rather than claiming zero.
            meta={exerciseCount ? `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}` : undefined}
            right={<WeekFigure done={doneThisWeek ?? 0} target={assignment.timesPerWeek ?? 1} />}
            onStart={() => onStart(template)}
            disabled={!startable}
        />
    )
}

/**
 * The "From your trainer" section of a Client's workouts.
 *
 * Its twin is SelfAuthoredWorkoutList, and the two differ in exactly two things:
 * where the Templates come from, and that a Client may edit their own. Both
 * render the same row, because a Workout Template is one kind of thing whoever
 * wrote it - only the label says which is which, and a Client's own is simply
 * not prescribed.
 *
 * Today (app/(tabs)/index.tsx) renders whichever Assignment is furthest behind
 * its Target Frequency as its own hero card and passes everything else here, so
 * this list is deliberately "the rest of what your trainer asked for" rather
 * than the whole prescribed set.
 */
const PrescribedWorkoutList = ({
    assignments,
    onStart,
    label = 'FROM YOUR TRAINER',
    /** Sessions performed this week, counted per Template id. */
    doneThisWeek,
    /** True while a Session is already open, or one is being started. */
    disabled,
}: {
    assignments: any[]
    onStart: (template: any) => void
    /** The section heading. A Trainer reading their Client's list calls it something else. */
    label?: string
    doneThisWeek?: Record<string, number>
    disabled?: boolean
}) => (
    <WorkoutSection label={label}>
        {assignments.map((assignment) => (
            <PrescribedWorkoutRow
                key={assignment.id}
                assignment={assignment}
                onStart={onStart}
                doneThisWeek={doneThisWeek?.[assignment.templateId]}
                disabled={disabled}
            />
        ))}
    </WorkoutSection>
)

export default PrescribedWorkoutList
