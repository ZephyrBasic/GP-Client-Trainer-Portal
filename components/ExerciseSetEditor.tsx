import { StyleSheet, TextInput, useColorScheme, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import Checkbox from './Checkbox'
import FieldError from './FieldError'
import SwipeToDelete from './SwipeToDelete'
import ThemedText from './ThemedText'
import Pressable from './Touchable'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { FontFamily, Type } from '../constants/Type'
import type { SetField } from '../types/exercise'
import { cleanSetInput, setInputKeyboard, type SetDraft } from '../utils/setDraft'

// Column headings, one per measurement, naming the unit: a bare number typed
// into a box is ambiguous in a way a read-only chip isn't. Short, because
// three of them share a phone's width with a set number and a tick.
const FIELD_LABELS: Record<SetField, string> = {
    reps: 'Reps',
    weightKg: 'Kg',
    durationSeconds: 'Secs',
    distanceMeters: 'Metres',
}

// Said in full to a screen reader, where the short heading has no column to sit in.
const FIELD_NAMES: Record<SetField, string> = {
    reps: 'reps',
    weightKg: 'weight in kg',
    durationSeconds: 'duration in seconds',
    distanceMeters: 'distance in metres',
}

// The trailing control on every row - the tick live, the remove ✕ otherwise -
// is a 48px target (see components/Checkbox). The column head row reserves
// the same width so headings sit over the boxes they name.
const TRAIL_WIDTH = 48

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
     * Session passes this; a `{done,total}` pair because the two numbers are
     * coloured differently.
     */
    progress?: { done: number; total: number }
    /**
     * Per-Set check-off, parallel to `sets`. Given, each row ends in a tick -
     * the live Session. Omitted, each row ends in a ✕ that removes the Set -
     * authoring a Template, setting a Client's targets and logging a past
     * Session, which have nothing to tick off.
     */
    checked?: boolean[]
    onToggleSet?: (setIndex: number) => void
    /**
     * What the control that drops this Exercise is called. Live, a prescribed
     * Exercise is *skipped* (asked for and not done) and one the Client added
     * is *deleted*; elsewhere it is removed.
     */
    removeLabel?: string
    onChangeSet: (setIndex: number, field: SetField, value: string) => void
    /**
     * The three that change an Exercise's *shape* rather than its numbers, all
     * optional: omit one and its control isn't rendered. Setting a Client's own
     * target loads needs this - their numbers are theirs, but how many Sets and
     * which Exercises are the Template's (ADR 0004). An absent control says this
     * is not where that is decided; a disabled one would imply it might be.
     */
    onAddSet?: () => void
    onRemoveSet?: (setIndex: number) => void
    onRemoveExercise?: () => void
    /** A save handler's complaint about this Exercise's Sets, drawn under them. */
    error?: string | null
}

/**
 * One Exercise and its editable Sets: a column per measurement the Exercise
 * declares, a row per Set, and the controls to add or drop either.
 *
 * Handed drafts and callbacks rather than a document - target Sets and
 * performed Sets are the same thing on screen, so the four screens that need
 * this (live Session, manual entry, authoring, a Client's targets) own the
 * state and this owns the layout.
 *
 * One layout for all four. It used to fork: the live Session had Signal's
 * card-per-Set rows with large numbers, the other three a grid of small boxed
 * inputs that overflowed a phone (the ✕ ended up off-screen) and looked like a
 * different app. Now the only difference is the row's trailing control - a
 * tick live, a ✕ elsewhere - because only the live Session has a moment to
 * tick anything off in.
 *
 * A changed number is not coloured or compared while the Client trains: a
 * ticked row is ticked, whatever it says. Whether the Session departed from
 * the plan is judged once, at completion, and shown on the summary.
 *
 * Only the columns this Exercise declares are drawn. A plank has no weight
 * column at all: an unused measurement is absent, never a zero.
 *
 * Values stay strings while on screen (see utils/setDraft), and each keystroke
 * is filtered to digits and one decimal point where the measurement has one.
 */
const ExerciseSetEditor = ({
    name,
    fields,
    sets,
    hint,
    editable = true,
    progress,
    checked,
    onToggleSet,
    removeLabel,
    onChangeSet,
    onAddSet,
    onRemoveSet,
    onRemoveExercise,
    error,
}: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const live = Boolean(checked)
    const done = progress?.done ?? (checked ?? []).filter(Boolean).length
    const total = progress?.total ?? sets.length
    const canRemoveSet = Boolean(onRemoveSet) && editable && sets.length > 1

    return (
        <View style={styles.exercise}>
            <View style={styles.headerRow}>
                <View style={styles.nameWrap}>
                    <ThemedText variant="cardTitle" tone="title" style={styles.name} numberOfLines={2} role="heading">
                        {name}
                    </ThemedText>
                    {hint ? (
                        <ThemedText variant="small" tone="muted">
                            {hint}
                        </ThemedText>
                    ) : null}
                </View>
                {/* Top-aligned with the name rather than centred on the name and
                    the hint together, which left it floating half a line low. */}
                {progress ? (
                    <View style={styles.progress}>
                        <ThemedText variant="metric" tone={done > 0 ? 'accent' : 'muted'} style={styles.progressDone}>
                            {done}
                        </ThemedText>
                        <ThemedText variant="small" tone="muted"> / {total}</ThemedText>
                    </View>
                ) : null}
            </View>

            <View style={styles.columnHeads}>
                <View style={styles.lead} />
                <View style={styles.fieldGrid}>
                    {fields.map((field) => (
                        <ThemedText key={field} variant="micro" tone="muted" style={styles.columnHead} numberOfLines={1}>
                            {FIELD_LABELS[field]}
                        </ThemedText>
                    ))}
                </View>
                <View style={styles.trail} />
            </View>

            <View style={styles.rows}>
                {sets.map((set, setIndex) => {
                    const isChecked = checked?.[setIndex] === true

                    return (
                        // Swipe stays as a shortcut; the ✕ (or, live, the Skip
                        // button below) is the control anyone can find.
                        <SwipeToDelete
                            key={setIndex}
                            enabled={canRemoveSet}
                            onDelete={() => onRemoveSet?.(setIndex)}
                            accessibilityLabel={`Set ${setIndex + 1}`}
                            collapseGap={Space.sm}
                        >
                            <View
                                style={[
                                    styles.row,
                                    isChecked
                                        ? [styles.rowTicked, { backgroundColor: theme.uiBackground, borderLeftColor: theme.iconColorFocused }]
                                        : [styles.rowUnticked, { backgroundColor: theme.uiBackground, borderColor: theme.line }],
                                ]}
                            >
                                <ThemedText variant="small" tone="muted" style={[styles.lead, styles.tabular, styles.numeralFont]}>
                                    {setIndex + 1}
                                </ThemedText>

                                <View style={styles.fieldGrid}>
                                    {fields.map((field) => {
                                        return (
                                            <View key={field} style={styles.valueCell}>
                                                <TextInput
                                                    value={set[field] ?? ''}
                                                    onChangeText={(text) => onChangeSet(setIndex, field, cleanSetInput(field, text))}
                                                    keyboardType={setInputKeyboard(field)}
                                                    // Explicit for the web, and autofill off: iOS
                                                    // was offering saved cards over a reps box.
                                                    inputMode={setInputKeyboard(field) === 'decimal-pad' ? 'decimal' : 'numeric'}
                                                    autoComplete="off"
                                                    autoCorrect={false}
                                                    editable={editable}
                                                    selectTextOnFocus
                                                    accessibilityLabel={`Set ${setIndex + 1}, ${FIELD_NAMES[field]}`}
                                                    // Never "0": an unrecorded measurement is
                                                    // absent, and a dash says so without looking
                                                    // like a value that was typed.
                                                    placeholder="—"
                                                    placeholderTextColor={theme.faint}
                                                    style={[
                                                        Type.metric,
                                                        styles.valueInput,
                                                        {
                                                            borderBottomColor: theme.lineSoft,
                                                            // Unticked values are real, editable
                                                            // numbers - body ink, not the mid-grey
                                                            // that read as disabled.
                                                            color: isChecked || !live ? theme.title : theme.text,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                        )
                                    })}
                                </View>

                                {live ? (
                                    <Checkbox
                                        value={isChecked}
                                        onPress={() => onToggleSet?.(setIndex)}
                                        disabled={!editable}
                                        label={`Set ${setIndex + 1} done`}
                                    />
                                ) : canRemoveSet ? (
                                    <Pressable
                                        onPress={() => onRemoveSet?.(setIndex)}
                                        accessibilityLabel={`Remove set ${setIndex + 1}`}
                                        style={styles.removeSet}
                                    >
                                        <Ionicons name="close" size={20} color={theme.iconColor} />
                                    </Pressable>
                                ) : (
                                    // The last Set keeps no ✕: an Exercise down to
                                    // zero Sets is removed as an Exercise.
                                    <View style={styles.trail} />
                                )}
                            </View>
                        </SwipeToDelete>
                    )
                })}
            </View>

            <FieldError>{error}</FieldError>

            {/* Add set is the everyday action and gets the pill. Dropping the
                whole Exercise is a smaller text button set apart at the right,
                not a twin pill beside it - grouped equals read as equally safe. */}
            {onAddSet || onRemoveExercise ? (
                <View style={styles.footer}>
                    {onAddSet ? (
                        <Pressable
                            onPress={onAddSet}
                            disabled={!editable}
                            style={[styles.addSet, { borderColor: theme.outline }]}
                        >
                            <Ionicons name="add" size={16} color={theme.text} />
                            <ThemedText variant="meta" tone="body">
                                Add set
                            </ThemedText>
                        </Pressable>
                    ) : (
                        <View style={styles.spacer} />
                    )}
                    {onRemoveExercise ? (
                        <Pressable onPress={onRemoveExercise} disabled={!editable} style={styles.removeExercise}>
                            <ThemedText variant="meta" tone="muted">
                                {removeLabel ?? 'Remove exercise'}
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    )
}

export default ExerciseSetEditor

const styles = StyleSheet.create({
    exercise: {
        gap: Space.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: Space.md,
    },
    nameWrap: {
        flex: 1,
        gap: Space.xs,
    },
    name: {
        fontSize: 17,
    },
    progress: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    progressDone: {
        lineHeight: 24,
    },
    columnHeads: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
        paddingHorizontal: Space.md,
    },
    // The Set-number column and the trailing column, held to the same widths
    // in the head row and every Set row so headings line up above the boxes.
    lead: {
        width: Space.xl,
    },
    trail: {
        width: TRAIL_WIDTH,
    },
    fieldGrid: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        gap: Space.sm,
    },
    columnHead: {
        flex: 1,
    },
    rows: {
        gap: Space.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
        paddingLeft: Space.md,
        paddingVertical: Space.xs,
    },
    rowUnticked: {
        borderWidth: 1,
        borderRadius: Radius.card,
    },
    // Ticked: a flat left rail and a rounded right side, so the accent (or
    // amber) reads as a rail rather than a border.
    rowTicked: {
        borderLeftWidth: 2,
        borderTopRightRadius: Radius.card,
        borderBottomRightRadius: Radius.card,
    },
    valueCell: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Space.xs,
    },
    // A quiet underline says "you can type here" on every row, ticked or not.
    valueInput: {
        flex: 1,
        minWidth: 0,
        paddingVertical: Space.xs,
        paddingHorizontal: 0,
        borderBottomWidth: 1,
        textAlign: 'left',
    },
    removeSet: {
        width: TRAIL_WIDTH,
        height: TRAIL_WIDTH,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.lg,
    },
    addSet: {
        flex: 1,
        minHeight: 48,
        borderWidth: 1,
        borderRadius: Radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.xs,
    },
    spacer: {
        flex: 1,
    },
    removeExercise: {
        minHeight: 48,
        paddingHorizontal: Space.md,
        borderRadius: Radius.pill,
        justifyContent: 'center',
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    // Space Grotesk is "every heading, every number" (TOKENS.md).
    numeralFont: {
        fontFamily: FontFamily.heading,
    },
})
