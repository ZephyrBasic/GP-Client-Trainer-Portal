import { StyleSheet, View, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Pressable from './Touchable'

import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { useWorkoutTemplate } from '../hooks/useWorkoutTemplates'

/**
 * One selectable plan.
 *
 * Presentation only - it is handed a name and told whether it is the chosen one,
 * so the same pill serves a Template loaded per row and one the caller already
 * holds.
 */
const PlanPill = ({
    label,
    selected,
    onPress,
    disabled,
}: {
    label: string
    selected: boolean
    onPress: () => void
    disabled?: boolean
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        // A choice chip: a pill like every other chip in the app (these were
        // the one rounded rectangle), with a tick when chosen, so it reads as
        // "pick one" rather than as a button.
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            style={styles.pillHit}
        >
            <View
                style={[
                    styles.pill,
                    selected
                        ? { backgroundColor: theme.accentTint, borderColor: theme.iconColorFocused }
                        : { backgroundColor: 'transparent', borderColor: theme.outline },
                    disabled && styles.pillDisabled,
                ]}
            >
                {selected ? <Ionicons name="checkmark" size={14} color={theme.iconColorFocused} /> : null}
                <ThemedText
                    style={[
                        styles.pillText,
                        selected ? { color: theme.iconColorFocused } : null,
                    ]}
                >
                    {label}
                </ThemedText>
            </View>
        </Pressable>
    )
}

/**
 * A prescribed Template, offered as something a past Session could have been.
 *
 * Reads its own Template for the same reason PrescribedWorkoutList's row does:
 * an Assignment names a Template and says nothing about it, and a Client cannot
 * simply query the collection - the read rule grants one document at a time on
 * the strength of an Assignment existing, and rules are not filters, so a
 * collection query would be rejected outright rather than trimmed.
 *
 * A Template whose current Version pointer hasn't arrived is not offered at all:
 * there would be nothing to prefill and no Version for the Session to cite.
 */
const AssignedPlanOption = ({
    assignment,
    selectedTemplateId,
    onSelect,
    disabled,
}: {
    assignment: any
    selectedTemplateId?: string | null
    onSelect: (template: any) => void
    disabled?: boolean
}) => {
    const { template } = useWorkoutTemplate(assignment.templateId)

    if (!template?.currentVersionId) return null

    return (
        <PlanPill
            label={template.name}
            selected={selectedTemplateId === template.id}
            onPress={() => onSelect(template)}
            disabled={disabled}
        />
    )
}

/**
 * Which workout a back-dated Session was.
 *
 * Training away from the app is still training against a plan, so a Session
 * entered afterwards can name the Template it ran and earn a verdict, rather
 * than silently becoming Self-Directed for want of a phone in the gym.
 *
 * "No plan" is first and is the default, because that is what manual entry was
 * before this existed and it stays the honest answer for a workout nobody
 * prescribed.
 *
 * The Version is not chosen here. A Session entered afterwards cites the
 * Template's *current* Version - the only one this app can honestly claim was in
 * force, since nothing recorded which numbers were on the phone that day - and
 * that pointer travels with the Template the row hands back (ADR 0002).
 */
const WorkoutPlanPicker = ({
    assignments,
    templates,
    selectedTemplateId,
    onSelect,
    disabled,
}: {
    assignments: any[]
    /**
     * The Client's own saved Templates, already loaded. Offered beside the
     * prescribed ones and not separated from them: this control asks which
     * workout was performed, and whose idea it was does not change the answer.
     */
    templates?: any[]
    /** The chosen Template's id, or null for "no plan". */
    selectedTemplateId?: string | null
    /** The whole loaded Template, or null when "no plan" is chosen. */
    onSelect: (template: any | null) => void
    disabled?: boolean
}) => {
    const own = (templates ?? []).filter((template) => template.currentVersionId)

    // Nothing to choose between is not a failure state, and a heading over a
    // single "No plan" pill would be a control with one setting.
    if (assignments.length === 0 && own.length === 0) return null

    return (
        <View>
            <ThemedText style={styles.label}>Which workout template was this?</ThemedText>
            <View style={styles.pills}>
                <PlanPill
                    label="No plan"
                    selected={!selectedTemplateId}
                    onPress={() => onSelect(null)}
                    disabled={disabled}
                />
                {assignments.map((assignment) => (
                    <AssignedPlanOption
                        key={assignment.id}
                        assignment={assignment}
                        selectedTemplateId={selectedTemplateId}
                        onSelect={onSelect}
                        disabled={disabled}
                    />
                ))}
                {own.map((template) => (
                    <PlanPill
                        key={template.id}
                        label={template.name}
                        selected={selectedTemplateId === template.id}
                        onPress={() => onSelect(template)}
                        disabled={disabled}
                    />
                ))}
            </View>
        </View>
    )
}

export default WorkoutPlanPicker

const styles = StyleSheet.create({
    label: {
        marginBottom: 8,
        fontSize: 13,
    },
    pills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pillHit: {
        borderRadius: 999,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
    },
    pillDisabled: {
        opacity: 0.5,
    },
    pillText: {
        fontSize: 13,
        fontWeight: '600',
    },
})
