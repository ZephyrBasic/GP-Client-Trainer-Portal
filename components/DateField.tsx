import { useEffect, useState, type Ref } from 'react'
import { StyleSheet, View, useColorScheme, TextInput } from 'react-native'
import Pressable from './Touchable'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import FieldError from './FieldError'
import ThemedTextInput from './ThemedTextInput'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { FontFamily } from '../constants/Type'
import {
    DATE_INPUT_FORMAT,
    longDateLabel,
    parseDateInput,
    toDateInput,
} from '../utils/dateInput'

// Monday-first, because a training week does. The weekday row and the leading
// blank cells are both derived from this one choice, so it cannot be changed in
// one place and forgotten in the other.
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const mondayIndex = (jsDay: number) => (jsDay + 6) % 7

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/**
 * The cells of one month's grid, with the leading blanks that put the 1st under
 * its own weekday. Trailing blanks are deliberately not padded to a fixed six
 * rows: a month that fits in five should not leave an empty row of dead space
 * under it, and the grid wraps on its own.
 */
const monthGrid = (year: number, month: number): (Date | null)[] => {
    const first = new Date(year, month, 1)
    const days = new Date(year, month + 1, 0).getDate()
    const lead = mondayIndex(first.getDay())

    return [
        ...Array.from({ length: lead }, () => null),
        ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
    ]
}

/**
 * The day a Session counts for: a typed DD-MM-YYYY box, and a calendar to pick
 * it from instead.
 *
 * Both, rather than either. Typing is the fastest way to enter a date you
 * already know - which is the manual-entry case, a Client writing up Tuesday's
 * workout on Thursday - and a calendar is the only sane way to answer "which
 * date was last Tuesday?", which is the same Client two sentences earlier. A
 * picker that replaced the box would make the first case slower; a box alone
 * makes the second case arithmetic.
 *
 * Drawn here rather than taken from a library, and that is the finding rather
 * than a shortcut. `@react-native-community/datetimepicker` is the usual
 * answer and hands each platform its own native dialog, but it is a native
 * module: it needs a development build on device, and on web it renders
 * nothing at all, which is the one platform this app is deployed on today.
 * `react-native-web`'s DOM escape hatch would give web a real `<input
 * type="date">` and leave native needing the module anyway. Sixty lines of
 * grid, in the app's own type and colour, works identically on all three
 * platforms and adds no dependency to a project whose stated position is not to
 * take one - see the technology table in CLAUDE.md.
 *
 * Opens *inline*, under the field, not in a Modal. Every screen that has a date
 * on it is already a ScrollView, and the live Session's finish card is itself
 * inside one - a Modal over that would have to reason about the keyboard, the
 * card's own scroll position and (on Android) the how-to player's Modal
 * fullscreen problem all over again. Pushing the content below it down is
 * predictable and costs nothing.
 *
 * Controlled, and its value is the *text* rather than a Date: half-typed input
 * is a real state ("04-0" on the way to "04-09-2026"), and a component that
 * handed back Dates would have to invent one for it. Parsing stays where it
 * already was, in the caller's save handler.
 */
const DateField = ({
    value,
    onChange,
    editable = true,
    error,
    inputRef,
}: {
    /** DD-MM-YYYY as the box holds it, mid-edit included. */
    value: string
    onChange: (value: string) => void
    editable?: boolean
    /** Set by the caller's save handler; replaces the read-back until the box changes. */
    error?: string | null
    /** So a failed save can put the cursor in the box (see .claude/rules/ui.md). */
    inputRef?: Ref<TextInput>
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const [open, setOpen] = useState(false)
    const selected = parseDateInput(value)
    const today = new Date()

    // Which month the grid is showing, which is not the same question as which
    // day is selected: paging back to August does not change the date until a
    // cell is tapped. Held as the first of the month so month arithmetic can
    // never land on a 31st that the next month doesn't have.
    const [cursor, setCursor] = useState(
        () => new Date((selected ?? today).getFullYear(), (selected ?? today).getMonth(), 1)
    )

    // Re-open on the month the box now holds. Typing a date with the calendar
    // shut, then opening it, should show that date rather than wherever the
    // grid was last left - but only on open, so paging around while it is open
    // is not undone by every keystroke.
    useEffect(() => {
        if (!open) return
        const at = parseDateInput(value) ?? new Date()
        setCursor(new Date(at.getFullYear(), at.getMonth(), 1))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const pick = (date: Date) => {
        onChange(toDateInput(date))
        setOpen(false)
    }

    const shiftMonth = (by: number) =>
        setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + by, 1))

    return (
        <View>
            <View style={styles.fieldRow}>
                <ThemedTextInput
                    ref={inputRef}
                    accessibilityLabel="Date"
                    value={value}
                    onChangeText={onChange}
                    placeholder={DATE_INPUT_FORMAT}
                    keyboardType="numbers-and-punctuation"
                    editable={editable}
                    style={styles.input}
                />
                <Pressable
                    onPress={() => setOpen((prev) => !prev)}
                    disabled={!editable}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={open ? 'Close the calendar' : 'Pick a date from the calendar'}
                    style={[
                        styles.calendarButton,
                        {
                            backgroundColor: open ? theme.accentTint : theme.uiBackground,
                            borderColor: open ? theme.iconColorFocused : theme.line,
                        },
                    ]}
                >
                    <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={open ? theme.iconColorFocused : theme.iconColor}
                    />
                </Pressable>
            </View>

            {/* The read-back. A date box is the one field on these screens whose
                value is unreadable at a glance - 04-09 and 09-04 look alike -
                so the day is spelled out under it whenever the box holds a real
                one, and says so plainly when it does not. */}
            {/* Muted while half-typed: that is a state, not an error. Only
                the save handler turns it red, and says why. */}
            {error ? (
                <FieldError>{error}</FieldError>
            ) : (
                <ThemedText variant="small" tone="muted" style={styles.readback}>
                    {selected ? longDateLabel(selected) : `Not a date yet — ${DATE_INPUT_FORMAT}`}
                </ThemedText>
            )}

            {open ? (
                <View
                    style={[
                        styles.calendar,
                        { backgroundColor: theme.uiBackground, borderColor: theme.line },
                    ]}
                >
                    <View style={styles.monthRow}>
                        <Pressable
                            onPress={() => shiftMonth(-1)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Previous month"
                            style={styles.monthArrow}
                        >
                            <Ionicons name="chevron-back" size={16} color={theme.text} />
                        </Pressable>
                        <ThemedText variant="cardTitle" tone="title">
                            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
                        </ThemedText>
                        <Pressable
                            onPress={() => shiftMonth(1)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Next month"
                            style={styles.monthArrow}
                        >
                            <Ionicons name="chevron-forward" size={16} color={theme.text} />
                        </Pressable>
                    </View>

                    <View style={styles.week}>
                        {WEEKDAYS.map((day, i) => (
                            <ThemedText
                                key={i}
                                variant="micro"
                                tone="faint"
                                style={[styles.cell, styles.weekdayLabel]}
                            >
                                {day}
                            </ThemedText>
                        ))}
                    </View>

                    <View style={styles.grid}>
                        {monthGrid(cursor.getFullYear(), cursor.getMonth()).map((date, i) =>
                            date ? (
                                <Pressable
                                    key={i}
                                    onPress={() => pick(date)}
                                    accessibilityRole="button"
                                    accessibilityLabel={longDateLabel(date)}
                                    style={[styles.cell, styles.dayCell]}
                                >
                                    {/* The mark is a fixed-size circle inside
                                        the cell rather than the cell itself:
                                        the column is a percentage so the grid
                                        holds at any width, and filling it would
                                        draw a 200px-wide lozenge on a desktop
                                        browser and a circle on a phone. */}
                                    <View
                                        style={[
                                            styles.day,
                                            selected && sameDay(date, selected)
                                                ? { backgroundColor: theme.iconColorFocused }
                                                : sameDay(date, today)
                                                  ? { backgroundColor: theme.accentTint }
                                                  : null,
                                        ]}
                                    >
                                        {/* The numeral font, like every other
                                            number in this app - a calendar is
                                            nothing but numbers in columns. */}
                                        <ThemedText
                                            variant="small"
                                            tone={
                                                selected && sameDay(date, selected)
                                                    ? 'onPrimary'
                                                    : sameDay(date, today)
                                                      ? 'accent'
                                                      : 'body'
                                            }
                                            style={styles.dayText}
                                        >
                                            {date.getDate()}
                                        </ThemedText>
                                    </View>
                                </Pressable>
                            ) : (
                                <View key={i} style={styles.cell} />
                            )
                        )}
                    </View>

                    {/* "Today" is the answer often enough - a Session finished
                        on the day it happened - to be worth one tap rather than
                        a hunt for the tinted cell, and it also pages the grid
                        home after someone has clicked back through six months. */}
                    <Pressable
                        onPress={() => pick(new Date())}
                        style={[styles.todayPill, { borderColor: theme.line }]}
                    >
                        <ThemedText variant="small" tone="accent">Today</ThemedText>
                    </Pressable>
                </View>
            ) : null}
        </View>
    )
}

export default DateField

const styles = StyleSheet.create({
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
    },
    input: {
        flex: 1,
    },
    calendarButton: {
        width: 44,
        height: 44,
        borderWidth: 1,
        borderRadius: Radius.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    readback: {
        marginTop: Space.xs + 2,
    },
    calendar: {
        marginTop: Space.sm,
        borderWidth: 1,
        borderRadius: Radius.hero,
        padding: Space.md,
        gap: Space.sm,
    },
    monthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    monthArrow: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    week: {
        flexDirection: 'row',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    // Seven to a row, and the one width both the weekday heads and the day
    // cells take - a percentage rather than a measured pixel so the grid holds
    // its columns at any card width.
    cell: {
        width: `${100 / 7}%`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    weekdayLabel: {
        textAlign: 'center',
        marginBottom: Space.xs,
    },
    // The tap target is the whole cell; the circle inside it is the mark.
    dayCell: {
        height: 40,
    },
    day: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        fontFamily: FontFamily.heading,
        fontVariant: ['tabular-nums'],
    },
    todayPill: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Space.md,
        paddingVertical: Space.xs + 2,
    },
})
