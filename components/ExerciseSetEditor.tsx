import { Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import Checkbox from './Checkbox'
import ThemedCard from './ThemedCard'
import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { FontFamily, Type } from '../constants/Type'
import type { SetField } from '../types/exercise'
import type { SetDraft } from '../utils/setDraft'

// Column headings, one per measurement. These name their unit
// where ExerciseInfoModal's chips deliberately don't: a bare number typed into a
// box is ambiguous in a way a read-only chip isn't.
const FIELD_LABELS: Record<SetField, string> = {
    reps: 'Reps',
    weightKg: 'Weight (kg)',
    durationSeconds: 'Duration (s)',
    distanceMeters: 'Distance (m)',
}

// The checkbox's own fixed diameter (see components/Checkbox.tsx) - the live
// row's trailing column has to reserve exactly this much, not a rounder
// number, so its column head lines up above a circle that never moves.
const CHECKBOX_WIDTH = 30

type Props = {
    /** The Exercise's display name, denormalised by the caller. */
    name: string
    /** Which measurements this Exercise declares; also the order columns render in. */
    fields: SetField[]
    sets: SetDraft[]
    /** One line under the name - "last time" when logging, the target when performing. */
    hint?: string
    /** Only the measurement inputs; the controls stay live, as they do while a save is in flight. */
    editable?: boolean
    /**
     * Sets ticked so far out of this Exercise's own count. Only the live
     * Session passes this - authoring a Template or logging one after the
     * fact has nothing to count off yet, which is also why this is a
     * `{done,total}` pair rather than the pre-joined string it replaced: the
     * live row needs the two numbers coloured differently, not just printed.
     */
    progress?: { done: number; total: number }
    /**
     * Per-Set check-off, parallel to `sets`. Given, each row gains a checkbox
     * and turns into the live Session's row-per-set view; omitted, no
     * checkbox column appears at all and the lead shows the Set number
     * instead - authoring a Template and logging one after the fact have
     * nothing to tick off, and an always-present column would imply
     * otherwise.
     */
    checked?: boolean[]
    /**
     * What each Set was prescribed, parallel to `sets` and read only - only
     * meaningful alongside `checked`. A ticked row compares itself against
     * its own entry here field by field: matching, it fills with the accent;
     * differing on any field, it and its checkbox go amber and the departed
     * figure carries its struck-through target beside it. A row past the
     * prescribed count - one the Client added by hand - has no entry here
     * and renders on-target, since there is nothing it could have departed
     * from. Absent entirely for a Self-Directed Session, where nothing was
     * prescribed at all.
     */
    targets?: SetDraft[]
    onToggleSet?: (setIndex: number) => void
    /** "Remove" while authoring; unused live, where skipping is its own pill. */
    removeLabel?: string
    onChangeSet: (setIndex: number, field: SetField, value: string) => void
    /**
     * The three that change an Exercise's *shape* rather than its numbers, and
     * the three that are optional: omit one and its control isn't rendered at
     * all. Setting a Client's own target loads is the case that needs this -
     * their numbers are theirs, but how many Sets and which Exercises are the
     * Template's, shared with everyone else assigned it (ADR 0004). A disabled
     * "+ Add Set" would imply it might become available; an absent one says
     * this is not where that is decided.
     */
    onAddSet?: () => void
    onRemoveSet?: (setIndex: number) => void
    onRemoveExercise?: () => void
}

/** A box read as a number, or null for empty/unparseable - never NaN. */
const numeric = (value?: string): number | null => {
    const trimmed = (value ?? '').trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
}

/**
 * Whether a performed measurement differs from what it was asked to be.
 * Numeric rather than string comparison, so a target and a performed value
 * that happen to be typed differently but mean the same number still match -
 * the live row is read live, off whatever is in the box right now, unlike
 * `compareSession`'s comparison of the final stored numbers.
 */
const departedField = (performed: string | undefined, target: string | undefined): boolean =>
    numeric(performed) !== numeric(target)

/**
 * One Exercise and its editable Sets: a column per measurement the Exercise
 * declares, a numbered row per Set, and the controls to add or drop either.
 *
 * It is handed drafts and callbacks rather than a document, and never reaches
 * for a Session or a Workout Template itself - target Sets and performed Sets
 * are the same thing on screen, so the three screens that need this block
 * (manual entry, authoring a Template, performing a Session) own the state and
 * this owns the layout.
 *
 * `checked` is the fork in that layout. Absent, this renders the authoring
 * grid every non-live screen shares - a boxed input per measurement, a Set
 * number for a lead, "+ Add Set" and "Remove" as plain links. Present, it
 * renders the live Session's row-per-set view instead: a numbered lead *and*
 * a checkbox, each row its own card, ticked rows lit by the accent or - if
 * they departed from target - by amber. The two views diverge this much
 * because only one of them has a moment to tick anything off in.
 *
 * Only the columns this Exercise declares are drawn either way. A plank has a
 * duration and no weight, so there is no weight column at all: an unused
 * measurement is absent, never a zero, and "no weight" has to stay
 * distinguishable from "lifted 0 kg" on screen as well as in the document.
 *
 * Values stay strings for as long as they are on screen (see utils/setDraft):
 * a component handing back numbers would have to invent a 0 for an empty box.
 */
const ExerciseSetEditor = ({
    name,
    fields,
    sets,
    hint,
    editable = true,
    progress,
    checked,
    targets,
    onToggleSet,
    removeLabel = 'Remove',
    onChangeSet,
    onAddSet,
    onRemoveSet,
    onRemoveExercise,
}: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    if (checked) {
        return (
            <LiveExercise
                theme={theme}
                name={name}
                fields={fields}
                sets={sets}
                hint={hint}
                editable={editable}
                progress={progress}
                checked={checked}
                targets={targets}
                onToggleSet={onToggleSet}
                onChangeSet={onChangeSet}
                onAddSet={onAddSet}
                onRemoveExercise={onRemoveExercise}
            />
        )
    }

    return (
        <ThemedCard>
            <View style={styles.headerRow}>
                <View style={styles.nameWrap}>
                    <ThemedText title={true} style={styles.name}>
                        {name}
                    </ThemedText>
                    {hint ? (
                        <ThemedText meta={true} style={styles.hint}>
                            {hint}
                        </ThemedText>
                    ) : null}
                </View>
                {onRemoveExercise ? (
                    <Pressable onPress={onRemoveExercise} hitSlop={8} style={styles.removeExercise}>
                        <ThemedText style={[styles.removeExerciseText, { color: theme.danger }]}>
                            {removeLabel}
                        </ThemedText>
                    </Pressable>
                ) : null}
            </View>

            <View style={styles.grid}>
                <View style={styles.row}>
                    {/* An empty cell over the Set-number column, so the
                        headings sit above the boxes they name. */}
                    <View style={styles.lead} />
                    {fields.map((field) => (
                        <ThemedText key={field} meta={true} style={styles.columnLabel}>
                            {FIELD_LABELS[field]}
                        </ThemedText>
                    ))}
                    <View style={styles.trail} />
                </View>

                {sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.row}>
                        <View style={styles.lead}>
                            <ThemedText meta={true} style={styles.setNumber}>
                                {setIndex + 1}
                            </ThemedText>
                        </View>

                        {fields.map((field) => (
                            <TextInput
                                key={field}
                                value={set[field] ?? ''}
                                onChangeText={(text) => onChangeSet(setIndex, field, text)}
                                keyboardType="numeric"
                                editable={editable}
                                selectTextOnFocus={true}
                                style={[
                                    styles.box,
                                    {
                                        backgroundColor: theme.background,
                                        borderColor: theme.line,
                                        color: theme.title,
                                    },
                                ]}
                            />
                        ))}

                        {/* The last Set keeps no ✕: an Exercise down to zero Sets
                            is removed as an Exercise. */}
                        {onRemoveSet && sets.length > 1 ? (
                            <Pressable
                                onPress={() => onRemoveSet(setIndex)}
                                hitSlop={8}
                                style={styles.trail}
                            >
                                <ThemedText style={{ color: theme.danger }}>✕</ThemedText>
                            </Pressable>
                        ) : (
                            <View style={styles.trail} />
                        )}
                    </View>
                ))}
            </View>

            {onAddSet ? (
                <Pressable onPress={onAddSet} hitSlop={8} style={styles.addSet}>
                    <ThemedText style={[styles.addSetText, { color: theme.iconColorFocused }]}>
                        + Add set
                    </ThemedText>
                </Pressable>
            ) : null}
        </ThemedCard>
    )
}

export default ExerciseSetEditor

/**
 * The live Session's own render path - see the module comment for why this is
 * a fork rather than a handful of conditionals threaded through one return.
 *
 * No outer card: Signal draws the whole stack as one scroll of exercises, each
 * a bare heading and its rows, so a card here would be a border around a
 * border once the screen wraps its own around the raised parts of the page.
 * Each Set row carries its own instead.
 */
const LiveExercise = ({
    theme,
    name,
    fields,
    sets,
    hint,
    editable,
    progress,
    checked,
    targets,
    onToggleSet,
    onChangeSet,
    onAddSet,
    onRemoveExercise,
}: {
    theme: (typeof Colors)['dark']
    name: string
    fields: SetField[]
    sets: SetDraft[]
    hint?: string
    editable: boolean
    progress?: { done: number; total: number }
    checked: boolean[]
    targets?: SetDraft[]
    onToggleSet?: (setIndex: number) => void
    onChangeSet: (setIndex: number, field: SetField, value: string) => void
    onAddSet?: () => void
    onRemoveExercise?: () => void
}) => {
    const done = progress?.done ?? checked.filter(Boolean).length
    const total = progress?.total ?? sets.length

    return (
        <View style={styles.liveExercise}>
            <View style={styles.liveHeaderRow}>
                <View style={styles.liveNameWrap}>
                    <ThemedText variant="heading" tone="title" numberOfLines={2}>
                        {name}
                    </ThemedText>
                    {hint ? (
                        <ThemedText variant="small" tone="muted" style={styles.liveHint}>
                            {hint}
                        </ThemedText>
                    ) : null}
                </View>
                <View style={styles.liveProgress}>
                    <ThemedText variant="metric" tone={done > 0 ? 'accent' : 'muted'}>
                        {done}
                    </ThemedText>
                    <ThemedText variant="small" tone="muted"> / {total}</ThemedText>
                </View>
            </View>

            <View style={styles.liveColumnHeads}>
                <View style={styles.liveLead} />
                <View style={styles.liveFieldGrid}>
                    {fields.map((field) => (
                        <ThemedText key={field} variant="micro" tone="faint" style={styles.liveColumnHead}>
                            {FIELD_LABELS[field]}
                        </ThemedText>
                    ))}
                </View>
                <View style={styles.liveTrail} />
            </View>

            <View style={styles.liveRows}>
                {sets.map((set, setIndex) => {
                    const isChecked = checked[setIndex] === true
                    const targetSet = targets?.[setIndex]
                    // Only a ticked row with an actual target to measure
                    // against can have departed from one - an untouched row
                    // isn't a claim yet, and a Set past the prescribed count
                    // has nothing to compare to.
                    const departedFields = isChecked && targetSet
                        ? fields.filter((field) => departedField(set[field], targetSet[field]))
                        : []
                    const departed = departedFields.length > 0
                    const edgeColor = departed ? theme.amber : theme.iconColorFocused

                    return (
                        <View
                            key={setIndex}
                            style={[
                                styles.liveRow,
                                isChecked
                                    ? [
                                          styles.liveRowTicked,
                                          { backgroundColor: theme.uiBackground, borderLeftColor: edgeColor },
                                      ]
                                    : [
                                          styles.liveRowUnticked,
                                          { backgroundColor: theme.navBackground, borderColor: theme.lineSoft },
                                      ],
                            ]}
                        >
                            {/* TOKENS.md: Space Grotesk is "every heading,
                                every number" - the Set index is a number, so
                                it takes the heading family even at body size. */}
                            <ThemedText
                                variant="small"
                                tone="faint"
                                style={[styles.liveLead, styles.tabular, styles.numeralFont]}
                            >
                                {setIndex + 1}
                            </ThemedText>

                            <View style={styles.liveFieldGrid}>
                                {fields.map((field) => {
                                    const fieldDeparted = departedFields.includes(field)
                                    const target = targetSet?.[field]
                                    return (
                                        <View key={field} style={styles.liveValueCell}>
                                            <TextInput
                                                value={set[field] ?? ''}
                                                onChangeText={(text) => onChangeSet(setIndex, field, text)}
                                                keyboardType="numeric"
                                                editable={editable}
                                                selectTextOnFocus
                                                // Never "0": an unrecorded
                                                // measurement is absent, and a
                                                // dash says so without looking
                                                // like a value that was typed.
                                                placeholder="—"
                                                placeholderTextColor={theme.faint}
                                                style={[
                                                    Type.metric,
                                                    styles.liveValueInput,
                                                    {
                                                        color: fieldDeparted
                                                            ? theme.amber
                                                            : isChecked
                                                              ? theme.title
                                                              : theme.iconColor,
                                                    },
                                                ]}
                                            />
                                            {fieldDeparted && target ? (
                                                <ThemedText
                                                    variant="small"
                                                    tone="muted"
                                                    style={styles.liveTargetStrike}
                                                >
                                                    {target}
                                                </ThemedText>
                                            ) : null}
                                        </View>
                                    )
                                })}
                            </View>

                            <Checkbox
                                value={isChecked}
                                onPress={() => onToggleSet?.(setIndex)}
                                disabled={!editable}
                                tone={departed ? 'amber' : 'accent'}
                            />
                        </View>
                    )
                })}
            </View>

            {onAddSet || onRemoveExercise ? (
                <View style={styles.livePillRow}>
                    {onAddSet ? (
                        <Pressable
                            onPress={onAddSet}
                            disabled={!editable}
                            style={[styles.livePill, { backgroundColor: theme.uiBackground, borderColor: theme.line }]}
                        >
                            <Ionicons name="add" size={13} color={theme.text} />
                            <ThemedText variant="small" tone="body">Add set</ThemedText>
                        </Pressable>
                    ) : null}
                    {onRemoveExercise ? (
                        <Pressable
                            onPress={onRemoveExercise}
                            disabled={!editable}
                            style={[styles.livePill, { backgroundColor: theme.uiBackground, borderColor: theme.line }]}
                        >
                            <ThemedText variant="small" tone="body">Skip exercise</ThemedText>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    )
}

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nameWrap: {
        flex: 1,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
    },
    hint: {
        fontSize: 11,
        marginTop: 1,
    },
    removeExercise: {
        marginLeft: 2,
    },
    removeExerciseText: {
        fontSize: 12,
        fontWeight: '600',
    },
    grid: {
        marginTop: 8,
        gap: 5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    lead: {
        width: 20,
        alignItems: 'center',
    },
    trail: {
        width: 18,
        alignItems: 'center',
    },
    setNumber: {
        fontSize: 11,
    },
    columnLabel: {
        flex: 1,
        fontSize: 10,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
    },
    box: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 5,
        paddingVertical: 6,
        paddingHorizontal: 7,
        fontSize: 13,
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
    },
    addSet: {
        marginTop: 9,
    },
    addSetText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Live Session rows.
    liveExercise: {
        gap: Space.md,
    },
    liveHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: Space.md,
    },
    liveNameWrap: {
        flex: 1,
        gap: Space.xs,
    },
    liveHint: {
        marginTop: 0,
    },
    liveProgress: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    liveColumnHeads: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
        paddingHorizontal: Space.md,
    },
    // The Set-number column and the checkbox column, held to the same widths
    // in the head row and every Set row below it so the headings line up
    // above boxes that never move.
    liveLead: {
        width: Space.xl,
    },
    liveTrail: {
        width: CHECKBOX_WIDTH,
    },
    liveFieldGrid: {
        flex: 1,
        flexDirection: 'row',
        gap: Space.sm,
    },
    liveColumnHead: {
        flex: 1,
    },
    liveRows: {
        gap: Space.sm,
    },
    liveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
        padding: Space.md,
    },
    liveRowUnticked: {
        borderWidth: 1,
        borderRadius: Radius.card,
    },
    // Ticked, on target or departed: a flat left edge and a rounded right
    // side, so the accent (or amber) reads as a rail rather than a border.
    liveRowTicked: {
        borderLeftWidth: 2,
        borderTopRightRadius: Radius.card,
        borderBottomRightRadius: Radius.card,
    },
    liveValueCell: {
        flex: 1,
    },
    liveValueInput: {
        padding: 0,
        textAlign: 'left',
    },
    liveTargetStrike: {
        textDecorationLine: 'line-through',
        marginTop: 1,
    },
    livePillRow: {
        flexDirection: 'row',
        gap: Space.sm,
    },
    livePill: {
        flex: 1,
        minHeight: 44,
        borderWidth: 1,
        borderRadius: Radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.xs + 3,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    // Overrides a Plex-based variant's fontFamily back to Space Grotesk, for a
    // number sitting at body size rather than one of the heading tokens.
    numeralFont: {
        fontFamily: FontFamily.heading,
    },
})
