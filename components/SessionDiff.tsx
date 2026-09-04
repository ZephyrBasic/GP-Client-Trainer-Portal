import { StyleSheet, View, useColorScheme } from 'react-native'

import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'
import { Space } from '../constants/Layout'
import { FontFamily } from '../constants/Type'
import { formatSet } from '../utils/formatSet'
import { deviations } from '../utils/prescription'
import type { ExerciseDiff } from '../utils/prescription'

/**
 * One deviation, as a marker and a sentence.
 *
 *   +  extra work, which is a deviation but not a failure to do anything
 *   ±  performed, but not as prescribed
 *   −  prescribed and not done
 *
 * Three glyphs rather than three words, because a Trainer scanning a session is
 * asking "is this worth opening?" and the shape of the left column answers that
 * before any of the text is read. The colours follow the palette's own grammar:
 * added is the accent, changed is amber, skipped is red.
 */
type Mark = 'added' | 'changed' | 'skipped'

const GLYPH: Record<Mark, string> = { added: '+', changed: '±', skipped: '−' }

type Line = { mark: Mark; text: string }

/**
 * Flattens the stored diff into the lines worth reading.
 *
 * **Only deviations.** An Exercise performed exactly as prescribed produces no
 * line at all - it is in the Session's own list of what was done, and a diff
 * exists to show what differed. Repeating every unchanged Set here buries the
 * three lines that matter under the workout.
 *
 * A whole Exercise added or skipped collapses to one line rather than one per
 * Set: "Plank — skipped" is the fact, and itemising three sets nobody did would
 * be three ways of saying it.
 */
const linesFrom = (diff?: ExerciseDiff[] | null): Line[] =>
    deviations(diff).flatMap((exercise): Line[] => {
        if (exercise.status === 'skipped') {
            return [{ mark: 'skipped', text: `${exercise.name} — skipped` }]
        }

        if (exercise.status === 'added') {
            const count = exercise.sets.length
            return [
                {
                    mark: 'added',
                    text: `${exercise.name} — ${count} set${count === 1 ? '' : 's'}, added`,
                },
            ]
        }

        return exercise.sets
            .filter((set) => set.status !== 'matched')
            .map((set): Line => {
                const where = `${exercise.name}, set ${set.set}`
                if (set.status === 'skipped') {
                    return {
                        mark: 'skipped',
                        text: `${where} — not done, target ${formatSet(set.target)}`,
                    }
                }
                if (set.status === 'added') {
                    return { mark: 'added', text: `${where} — ${formatSet(set.performed)}, extra` }
                }
                return {
                    mark: 'changed',
                    text: `${where} — ${formatSet(set.performed)}, target ${formatSet(set.target)}`,
                }
            })
    })

/**
 * Names of the Exercises that matched exactly, said once each rather than left
 * silent.
 *
 * Only reached alongside at least one deviation (see the `lines.length === 0`
 * guard below) - a wholly matched Session is As Prescribed and says so with its
 * verdict alone, with nothing here to itemise. But a Modified Session usually
 * has both: the deviations are what earns opening the diff, and a quiet "this
 * one was fine" line beside them is what stops a Trainer re-checking an
 * Exercise the itemisation already vouches for.
 */
const matchedNamesFrom = (diff?: ExerciseDiff[] | null): string[] =>
    (diff ?? []).filter((exercise) => exercise.status === 'matched').map((exercise) => exercise.name)

/**
 * The itemised account of a Session against what was asked of it.
 *
 * Renders a stored diff and computes nothing: the verdict and this list were
 * decided once at completion and never recomputed (ADR 0002), so a screen that
 * worked any of it out again could disagree with the verdict shown beside it.
 *
 * Written against the shape utils/prescription produces rather than against a
 * Session document, so the Client's own history and the Trainer's review of it
 * render the same thing from the same component.
 *
 * Renders null when nothing deviated - which is what an As Prescribed Session
 * is. There is no empty state to draw, because "nothing changed" is already
 * said, once, by the verdict.
 */
const SessionDiff = ({ diff }: { diff?: ExerciseDiff[] | null }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const lines = linesFrom(diff)
    if (lines.length === 0) return null
    const matchedNames = matchedNamesFrom(diff)

    const colorOf = (mark: Mark) =>
        mark === 'added' ? theme.iconColorFocused : mark === 'changed' ? theme.amber : theme.danger

    return (
        <View style={styles.lines}>
            {lines.map((line, index) => (
                <View key={index} style={styles.line}>
                    <ThemedText style={[styles.mark, { color: colorOf(line.mark) }]}>
                        {GLYPH[line.mark]}
                    </ThemedText>
                    <ThemedText variant="meta" tone="body" style={styles.text}>
                        {line.text}
                    </ThemedText>
                </View>
            ))}
            {matchedNames.map((name) => (
                <ThemedText key={name} variant="small" tone="faint">
                    {name} matched.
                </ThemedText>
            ))}
        </View>
    )
}

export default SessionDiff

const styles = StyleSheet.create({
    lines: {
        gap: Space.sm - 1,
    },
    line: {
        flexDirection: 'row',
        gap: Space.sm,
        alignItems: 'flex-start',
    },
    // Space Grotesk rather than the meta text's Plex, at roughly the same size
    // as the line beside it - TOKENS.md calls out "every heading, every
    // number" for the heading family, and a glyph reads as a mark rather than
    // a word precisely because it stands apart from the sentence it leads.
    mark: {
        fontFamily: FontFamily.heading,
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 17,
        width: 11,
    },
    text: {
        flex: 1,
        lineHeight: 17,
    },
})
