import { useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import WorkoutSection from './WorkoutSection'
import WorkoutStartRow from './WorkoutStartRow'
import { Colors } from '../constants/Colors'

/**
 * The "Your own" section of a Client's workouts.
 *
 * A routine the Client saved for themselves - one nobody prescribed - and it
 * starts exactly like an assigned one. That sameness is the point of ticket 12
 * rather than an economy: a Workout Template is one kind of thing whoever wrote
 * it, so a Client's own earns the same Versions, the same targets and the same
 * verdict on the Sessions performed against it.
 *
 * What it is *not* is prescribed. It carries no Target Frequency, because
 * nobody expects anything of it, and no "done this week" for the same reason -
 * there is nothing to be done against. A plain chevron stands where the
 * prescribed row shows its "n of m", since there is no target here to name.
 * It appears under its own label so a Client can always tell whose workout they
 * are looking at, and no Assignment exists for it, which is what makes the
 * distinction structural rather than cosmetic: `useClientAssignments` will
 * never return one of these.
 *
 * No per-row read here, unlike the prescribed list: these Templates arrive
 * already loaded from `useWorkoutTemplates(uid)`, since the Client is their
 * author and may query their own.
 */
const SelfAuthoredWorkoutList = ({
    templates,
    onStart,
    onEdit,
    /** True while a Session is already open, or one is being started. */
    disabled,
}: {
    templates: any[]
    onStart: (template: any) => void
    onEdit: (template: any) => void
    disabled?: boolean
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <WorkoutSection label="YOUR OWN">
            {templates.map((template) => {
                const exerciseCount = template.currentVersionExerciseCount
                // As on the prescribed row: absent on anything authored before
                // the count was recorded, so the clause drops rather than
                // claiming zero.
                const meta = exerciseCount
                    ? `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`
                    : undefined

                return (
                    <WorkoutStartRow
                        key={template.id}
                        name={template.name}
                        meta={meta}
                        right={<Ionicons name="chevron-forward" size={18} color={theme.faint} />}
                        onStart={() => onStart(template)}
                        onEdit={() => onEdit(template)}
                        disabled={!template.currentVersionId || disabled}
                    />
                )
            })}
        </WorkoutSection>
    )
}

export default SelfAuthoredWorkoutList
