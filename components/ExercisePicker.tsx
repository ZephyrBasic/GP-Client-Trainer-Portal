import { useMemo, useState, type ReactNode } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import ThemedButton from './ThemedButton'
import SectionLabel from './SectionLabel'
import Spacer from './Spacer'
import BottomSheet from './BottomSheet'
import ExerciseInfoModal from './ExerciseInfoModal'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { Type } from '../constants/Type'
import {
    FACET_VALUES,
    allExercises,
    buildIndex,
    fieldsFor,
    searchExercises,
    spaceCase,
    tagValues,
    titleCase,
} from '../utils/exerciseSearch'
import { useAuth } from '../contexts/AuthContext'
import { useCustomExercises } from '../hooks/useCustomExercises'

// The five facets a movement is tagged on (scripts/exerciseVocab.js), in the
// order the artboard draws them: three as their own pill, the rest behind the
// overflow "⋯" - five facets and ~92 values between them will not fit laid out
// flat on a phone width.
type Facet = 'muscle' | 'equipment' | 'pattern' | 'modality' | 'role'
const VISIBLE_FACETS: Facet[] = ['muscle', 'equipment', 'pattern']
const OVERFLOW_FACETS: Facet[] = ['modality', 'role']
const ALL_FACETS: Facet[] = [...VISIBLE_FACETS, ...OVERFLOW_FACETS]

const emptyFilters = (): Record<Facet, Set<string>> => ({
    muscle: new Set(),
    equipment: new Set(),
    pattern: new Set(),
    modality: new Set(),
    role: new Set(),
})

// A unit beside a number in the meta line ("kg · reps"), not the full field
// name ExerciseSetEditor's column heads use - a row here is a caption, read in
// passing while scanning a list, not a label over a box someone is about to type in.
const UNIT_LABEL = {
    weightKg: 'kg',
    reps: 'reps',
    durationSeconds: 's',
    distanceMeters: 'm',
}

// High enough to clear the whole catalog (317 records) plus a trainer's own
// additions, so facet filtering below always sees every match rather than a
// pre-truncated sample - searchExercises itself is what limits an unfiltered
// list, and 200 used to cut it short before the facets ever ran.
const SEARCH_LIMIT = 1000

// The `role:` filter this replaced covered seven of ten Role values and none of
// the other four facets. Custom exercises are out of scope while the core loop
// is built (see CLAUDE.md), so this stays the only source; the flag and the
// gated "add to library" path below exist so switching it back on is a one-line
// change, same as the picker it replaces.
const CUSTOM_EXERCISES_ENABLED: boolean = false

const MEASUREMENT_OPTIONS = [
    { label: 'Weight + reps', fields: ['weightKg', 'reps'] },
    { label: 'Reps only', fields: ['reps'] },
    { label: 'Time', fields: ['durationSeconds'] },
    { label: 'Distance + time', fields: ['distanceMeters', 'durationSeconds'] },
    { label: 'Weight + distance', fields: ['weightKg', 'distanceMeters'] },
    { label: 'Weight + time', fields: ['weightKg', 'durationSeconds'] },
]

const NEW_ROLE_OPTIONS = ['compound', 'accessory', 'isolation', 'core', 'prehab', 'warmup', 'conditioning']

/**
 * One facet's own pill - plain text and a chevron until something is chosen in
 * it, then the accent and a count badge instead, so a Trainer can tell which
 * of the five facets are doing anything without opening any of them.
 *
 * Module-level rather than declared inside ExercisePicker's body: a component
 * defined fresh on every render is a new type as far as React is concerned, so
 * every keystroke in the search box would have remounted this - fine for a
 * Pressable with no state of its own, but it's the same reason `Sheet` below
 * lives out here too.
 */
const FacetButton = ({
    facet,
    count,
    onPress,
    theme,
}: {
    facet: Facet
    count: number
    onPress: () => void
    theme: (typeof Colors)['dark']
}) => {
    const active = count > 0
    return (
        <Pressable
            onPress={onPress}
            hitSlop={6}
            style={[
                styles.facetPill,
                active
                    ? { backgroundColor: theme.raised, borderColor: theme.iconColorFocused }
                    : { backgroundColor: theme.uiBackground, borderColor: theme.line },
            ]}
        >
            <ThemedText variant="small" tone={active ? 'accent' : 'muted'} style={styles.facetLabel}>
                {titleCase(facet)}
            </ThemedText>
            {active ? (
                <View style={[styles.facetBadge, { backgroundColor: theme.iconColorFocused }]}>
                    <ThemedText style={[styles.facetBadgeText, { color: theme.background }]}>{count}</ThemedText>
                </View>
            ) : (
                <Ionicons name="chevron-down" size={11} color={theme.iconColor} />
            )}
        </Pressable>
    )
}

/**
 * The shared shell for the two bottom sheets - a facet's own values, and the
 * overflow menu naming the facets that don't fit their own pill. Module-level
 * for the same remount reason as `FacetButton` above. Only the height cap is
 * this picker's; the rest is the house BottomSheet.
 */
const Sheet = ({
    visible,
    onRequestClose,
    children,
}: {
    visible: boolean
    onRequestClose: () => void
    children: ReactNode
}) => (
    <BottomSheet visible={visible} onClose={onRequestClose} style={styles.sheet}>
        {children}
    </BottomSheet>
)

/**
 * Select-only exercise chooser. Clients pick from the repository rather than
 * typing a name, so logged exercises always resolve to a known id - which is
 * what makes history lookup and cross-client reporting possible.
 *
 * One exercise per open, unchanged from before Signal: tapping a row toggles
 * which one is marked (the tick and the accent left edge, echoing a ticked Set
 * row elsewhere in the app), and the footer button is what actually hands it
 * back through `onSelect` - a confirm step rather than an instant pick, so the
 * "already added" state the artboard draws has something to show. Tapping a
 * second row simply moves the mark; nothing here accumulates a list; the
 * caller's `onSelect` contract (one exercise, then the caller closes this) is
 * exactly what it was.
 *
 * Trainers additionally get an "add to library" path for movements the bundled
 * repository lacks - gated off by CUSTOM_EXERCISES_ENABLED, so today the shared
 * catalog is the only source.
 */
const ExercisePicker = ({ visible, onSelect, onClose }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    // See ExerciseInfoModal: real insets rather than a hardcoded top padding.
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    // Passing null while gated off keeps the hook from opening its subscription at
    // all, rather than opening one and discarding the rows.
    const { customExercises, addCustomExercise } = useCustomExercises(
        CUSTOM_EXERCISES_ENABLED ? profile : null
    )

    const canAddExercise = CUSTOM_EXERCISES_ENABLED && profile?.role === 'trainer'

    const [query, setQuery] = useState('')
    const [filters, setFilters] = useState(emptyFilters)
    const [openFacet, setOpenFacet] = useState<Facet | null>(null)
    const [overflowOpen, setOverflowOpen] = useState(false)
    // The row currently marked, not yet handed to the caller - see the module
    // comment for why this is a confirm step rather than an instant pick.
    const [selected, setSelected] = useState(null)
    const [adding, setAdding] = useState(false)
    const [newMeasurement, setNewMeasurement] = useState(MEASUREMENT_OPTIONS[0].label)
    const [newRole, setNewRole] = useState('accessory')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    // The exercise whose how-to page is open, layered over this picker.
    const [infoExercise, setInfoExercise] = useState(null)

    const customIndex = useMemo(() => buildIndex(customExercises), [customExercises])

    // The real catalog size, not a hardcoded "317" - it names both the search
    // placeholder and the "N of TOTAL" count, and it is exact for as long as
    // custom exercises stay gated off above.
    const totalCount = allExercises.length

    const searched = useMemo(
        () => searchExercises(query, SEARCH_LIMIT, customIndex),
        [query, customIndex]
    )
    const results = useMemo(
        () =>
            searched.filter((exercise) =>
                ALL_FACETS.every((facet) => {
                    const active = filters[facet]
                    if (active.size === 0) return true
                    return tagValues(exercise, facet).some((value) => active.has(value))
                })
            ),
        [searched, filters]
    )

    const activeChips = ALL_FACETS.flatMap((facet) =>
        Array.from(filters[facet]).map((value) => ({ facet, value }))
    )

    const toggleFacetValue = (facet: Facet, value: string) => {
        setFilters((prev) => {
            const next = { ...prev, [facet]: new Set(prev[facet]) }
            if (next[facet].has(value)) next[facet].delete(value)
            else next[facet].add(value)
            return next
        })
    }

    const reset = () => {
        setQuery('')
        setFilters(emptyFilters())
        setOpenFacet(null)
        setOverflowOpen(false)
        setSelected(null)
        setAdding(false)
        setError('')
        setNewMeasurement(MEASUREMENT_OPTIONS[0].label)
        setNewRole('accessory')
        setInfoExercise(null)
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const toggleSelect = (exercise) =>
        setSelected((prev) => (prev?.id === exercise.id ? null : exercise))

    const handleCommit = () => {
        if (!selected) return
        const exercise = selected
        reset()
        onSelect(exercise)
    }

    const handleAdd = async () => {
        setError('')
        const name = query.trim()
        if (name.length < 2) {
            setError('Enter a name for the exercise.')
            return
        }
        // Guard against re-adding something already in the library under a
        // slightly different spelling.
        const clash = searchExercises(name, 5, customIndex).find(
            (e) => e.name.toLowerCase() === name.toLowerCase()
        )
        if (clash) {
            setError(`"${clash.name}" is already in the library.`)
            return
        }

        setSaving(true)
        try {
            const measurement = MEASUREMENT_OPTIONS.find((o) => o.label === newMeasurement)
            await addCustomExercise({ name, fields: measurement.fields, tags: [`role:${newRole}`] })
            setAdding(false)
            setSaving(false)
        } catch (err) {
            setError(err.message || 'Could not add the exercise.')
            setSaving(false)
        }
    }

    const renderChip = (label, active, onPress) => (
        <Pressable
            key={label}
            onPress={onPress}
            hitSlop={6}
            style={[
                styles.legacyChip,
                { borderColor: active ? theme.iconColorFocused : theme.line },
                active && { backgroundColor: theme.accentTint },
            ]}
        >
            <ThemedText variant="small" tone={active ? 'accent' : 'muted'}>{label}</ThemedText>
        </Pressable>
    )

    const overflowCount = OVERFLOW_FACETS.reduce((n, facet) => n + filters[facet].size, 0)

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
            <View
                style={[
                    styles.container,
                    { backgroundColor: theme.background, paddingTop: insets.top + Space.xxl },
                ]}
            >
                <View style={styles.headerRow}>
                    <ThemedText variant="title" tone="title">
                        {adding ? 'New exercise' : 'Add exercise'}
                    </ThemedText>
                    <Pressable
                        onPress={adding ? () => setAdding(false) : handleClose}
                        hitSlop={6}
                        style={[styles.closeBtn, { backgroundColor: theme.uiBackground, borderColor: theme.line }]}
                        accessibilityRole="button"
                        accessibilityLabel={adding ? 'Back' : 'Close'}
                    >
                        <Ionicons
                            name={adding ? 'chevron-back' : 'close'}
                            size={16}
                            color={theme.text}
                        />
                    </Pressable>
                </View>
                <Spacer height={Space.md} />

                {adding ? (
                    <>
                        <ThemedTextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Exercise name"
                            autoFocus
                            autoCorrect={false}
                            autoCapitalize="words"
                        />

                        <Spacer height={Space.lg} />
                        <SectionLabel>How is it measured?</SectionLabel>
                        <Spacer height={Space.sm} />
                        <View style={styles.legacyChipRow}>
                            {MEASUREMENT_OPTIONS.map((option) =>
                                renderChip(option.label, newMeasurement === option.label, () =>
                                    setNewMeasurement(option.label)
                                )
                            )}
                        </View>

                        <Spacer height={Space.lg} />
                        <SectionLabel>Role</SectionLabel>
                        <Spacer height={Space.sm} />
                        <View style={styles.legacyChipRow}>
                            {NEW_ROLE_OPTIONS.map((value) =>
                                renderChip(titleCase(value), newRole === value, () => setNewRole(value))
                            )}
                        </View>

                        {error ? (
                            <>
                                <Spacer height={Space.lg} />
                                <ThemedText variant="body" tone="danger">{error}</ThemedText>
                            </>
                        ) : null}

                        <Spacer height={Space.xl} />
                        <ThemedButton onPress={handleAdd} disabled={saving}>
                            <ThemedText variant="label" tone="onPrimary">
                                {saving ? 'ADDING' : 'ADD TO LIBRARY'}
                            </ThemedText>
                        </ThemedButton>
                    </>
                ) : (
                    <>
                        <View
                            style={[
                                styles.searchWrap,
                                { backgroundColor: theme.uiBackground, borderColor: theme.line },
                            ]}
                        >
                            <Ionicons name="search" size={16} color={theme.iconColor} />
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder={`Search ${totalCount} exercises`}
                                placeholderTextColor={theme.iconColor}
                                autoFocus
                                autoCorrect={false}
                                autoCapitalize="none"
                                style={[Type.body, styles.searchInput, { color: theme.title }]}
                            />
                        </View>

                        <Spacer height={Space.md} />
                        <View style={styles.facetsRow}>
                            {VISIBLE_FACETS.map((facet) => (
                                <FacetButton
                                    key={facet}
                                    facet={facet}
                                    count={filters[facet].size}
                                    onPress={() => setOpenFacet(facet)}
                                    theme={theme}
                                />
                            ))}
                            <Pressable
                                onPress={() => setOverflowOpen(true)}
                                hitSlop={6}
                                style={[
                                    styles.facetPill,
                                    styles.overflowPill,
                                    overflowCount > 0
                                        ? { backgroundColor: theme.raised, borderColor: theme.iconColorFocused }
                                        : { backgroundColor: theme.uiBackground, borderColor: theme.line },
                                ]}
                            >
                                <Ionicons
                                    name="ellipsis-horizontal"
                                    size={15}
                                    color={overflowCount > 0 ? theme.iconColorFocused : theme.iconColor}
                                />
                                {overflowCount > 0 ? (
                                    <View
                                        style={[
                                            styles.facetBadge,
                                            styles.overflowBadge,
                                            { backgroundColor: theme.iconColorFocused },
                                        ]}
                                    >
                                        <ThemedText style={[styles.facetBadgeText, { color: theme.background }]}>
                                            {overflowCount}
                                        </ThemedText>
                                    </View>
                                ) : null}
                            </Pressable>
                        </View>

                        <Spacer height={Space.md} />
                        <View style={styles.chipsRow}>
                            <View style={styles.chipsWrap}>
                                {activeChips.map(({ facet, value }) => (
                                    <Pressable
                                        key={`${facet}:${value}`}
                                        onPress={() => toggleFacetValue(facet, value)}
                                        hitSlop={6}
                                        style={[
                                            styles.activeChip,
                                            { backgroundColor: theme.accentTint, borderColor: theme.iconColorFocused },
                                        ]}
                                    >
                                        <ThemedText variant="small" tone="accent">{titleCase(value)}</ThemedText>
                                        <Ionicons name="close" size={11} color={theme.iconColorFocused} />
                                    </Pressable>
                                ))}
                            </View>
                            <ThemedText variant="small" tone="muted" style={styles.countText}>
                                <ThemedText variant="small" tone="title" style={styles.countNumber}>
                                    {results.length}
                                </ThemedText>
                                {' '}of {totalCount}
                            </ThemedText>
                        </View>

                        <Spacer height={Space.md} />
                        <View style={[styles.divider, { backgroundColor: theme.lineSoft }]} />
                        <Spacer height={Space.sm} />

                        <FlatList
                            data={results}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.listContent}
                            ItemSeparatorComponent={() => <Spacer height={Space.sm - 1} />}
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <ThemedText variant="body" tone="muted" style={styles.emptyText}>
                                        No exercise matches "{query}".
                                    </ThemedText>
                                    <Spacer height={Space.xs + 2} />
                                    <ThemedText variant="small" tone="muted" style={styles.emptyText}>
                                        {!CUSTOM_EXERCISES_ENABLED
                                            ? 'Try another name - the catalog is the only source of exercises.'
                                            : canAddExercise
                                                ? 'Add it to the library so your clients can log it.'
                                                : 'Ask your trainer to add it to the library.'}
                                    </ThemedText>
                                    {canAddExercise ? (
                                        <>
                                            <Spacer height={Space.lg} />
                                            <Pressable onPress={() => setAdding(true)} hitSlop={8}>
                                                <ThemedText variant="small" tone="accent" style={styles.addLink}>
                                                    + Add "{query.trim()}"
                                                </ThemedText>
                                            </Pressable>
                                        </>
                                    ) : null}
                                </View>
                            }
                            renderItem={({ item }) => {
                                const isSelected = selected?.id === item.id
                                const hasVideo = Boolean(item.videoUrl)
                                const units = fieldsFor(item)
                                    .map((field) => UNIT_LABEL[field])
                                    .join(' · ')
                                const equipment = tagValues(item, 'equipment')[0]
                                const pattern = tagValues(item, 'pattern')[0]
                                const tagLine = [equipment, pattern].filter(Boolean).map(spaceCase).join(' · ')
                                const meta = [units, tagLine].filter(Boolean).join('  |  ')

                                return (
                                    <Pressable
                                        onPress={() => toggleSelect(item)}
                                        style={[
                                            styles.row,
                                            { backgroundColor: theme.uiBackground },
                                            isSelected
                                                ? [styles.rowSelected, { borderLeftColor: theme.iconColorFocused }]
                                                : styles.rowUnselected,
                                        ]}
                                    >
                                        <View style={styles.rowText}>
                                            <View style={styles.rowNameLine}>
                                                <ThemedText
                                                    variant="cardTitle"
                                                    tone="title"
                                                    numberOfLines={1}
                                                    style={styles.rowNameText}
                                                >
                                                    {item.name}
                                                </ThemedText>
                                                {hasVideo ? (
                                                    // Its own tap target, so opening the how-to
                                                    // does not also mark this row selected.
                                                    <Pressable
                                                        onPress={() => setInfoExercise(item)}
                                                        hitSlop={14}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`How to do ${item.name}`}
                                                    >
                                                        <Ionicons name="play-circle" size={13} color={theme.faint} />
                                                    </Pressable>
                                                ) : null}
                                                {item.isCustom ? (
                                                    <ThemedText variant="small" tone="accent">Custom</ThemedText>
                                                ) : null}
                                            </View>
                                            <ThemedText variant="small" tone="muted" numberOfLines={1}>
                                                {meta}
                                            </ThemedText>
                                        </View>
                                        <View
                                            style={[
                                                styles.control,
                                                isSelected
                                                    ? { backgroundColor: theme.iconColorFocused }
                                                    : { borderColor: theme.line, borderWidth: 1 },
                                            ]}
                                        >
                                            <Ionicons
                                                name={isSelected ? 'checkmark' : 'add'}
                                                size={15}
                                                color={isSelected ? theme.background : theme.text}
                                            />
                                        </View>
                                    </Pressable>
                                )
                            }}
                            ListFooterComponent={
                                canAddExercise && results.length > 0 ? (
                                    <Pressable onPress={() => setAdding(true)} style={styles.footerAdd} hitSlop={8}>
                                        <ThemedText variant="small" tone="accent" style={styles.addLink}>
                                            + Add a new exercise
                                        </ThemedText>
                                    </Pressable>
                                ) : null
                            }
                        />

                        <View style={[styles.footer, { borderTopColor: theme.lineSoft, backgroundColor: theme.background }]}>
                            <ThemedButton onPress={handleCommit} disabled={!selected}>
                                <ThemedText variant="label" tone="onPrimary">
                                    {selected ? 'ADD 1 EXERCISE' : 'ADD EXERCISE'}
                                </ThemedText>
                            </ThemedButton>
                        </View>
                    </>
                )}
            </View>

            {/* One facet's values. Multi-select within the facet - ticking
                Quads and Hamstrings both narrows to either, since a Trainer
                filtering "Muscle" usually means "any of these". */}
            <Sheet
                visible={openFacet != null}
                onRequestClose={() => setOpenFacet(null)}
            >
                {openFacet ? (
                    <>
                        <View style={styles.sheetHeaderRow}>
                            <ThemedText variant="cardTitle" tone="title">{titleCase(openFacet)}</ThemedText>
                            {filters[openFacet].size > 0 ? (
                                <Pressable
                                    onPress={() =>
                                        setFilters((prev) => ({ ...prev, [openFacet]: new Set() }))
                                    }
                                    hitSlop={8}
                                >
                                    <ThemedText variant="small" tone="accent">Clear</ThemedText>
                                </Pressable>
                            ) : null}
                        </View>
                        <Spacer height={Space.sm} />
                        <FlatList
                            data={FACET_VALUES[openFacet]}
                            keyExtractor={(value) => value}
                            style={styles.sheetList}
                            renderItem={({ item: value }) => {
                                const active = filters[openFacet].has(value)
                                return (
                                    <Pressable
                                        onPress={() => toggleFacetValue(openFacet, value)}
                                        style={styles.sheetRow}
                                    >
                                        <ThemedText variant="body" tone="title">{titleCase(value)}</ThemedText>
                                        <View
                                            style={[
                                                styles.sheetCheck,
                                                active
                                                    ? { backgroundColor: theme.iconColorFocused }
                                                    : { borderColor: theme.line, borderWidth: 1.5 },
                                            ]}
                                        >
                                            {active ? (
                                                <Ionicons name="checkmark" size={13} color={theme.background} />
                                            ) : null}
                                        </View>
                                    </Pressable>
                                )
                            }}
                        />
                        <Spacer height={Space.sm} />
                        <ThemedButton variant="ghost" onPress={() => setOpenFacet(null)}>
                            <ThemedText variant="body" tone="title">Done</ThemedText>
                        </ThemedButton>
                    </>
                ) : null}
            </Sheet>

            {/* The facets that don't fit their own pill - naming one hands off
                to its own value sheet above, rather than trying to cram a
                second level of selection into this same list. */}
            <Sheet
                visible={overflowOpen}
                onRequestClose={() => setOverflowOpen(false)}
            >
                <ThemedText variant="cardTitle" tone="title">More filters</ThemedText>
                <Spacer height={Space.sm} />
                {OVERFLOW_FACETS.map((facet) => (
                    <Pressable
                        key={facet}
                        onPress={() => {
                            setOverflowOpen(false)
                            setOpenFacet(facet)
                        }}
                        style={styles.sheetRow}
                    >
                        <ThemedText variant="body" tone="title">{titleCase(facet)}</ThemedText>
                        <View style={styles.overflowRowTrail}>
                            {filters[facet].size > 0 ? (
                                <View style={[styles.facetBadge, { backgroundColor: theme.iconColorFocused }]}>
                                    <ThemedText style={[styles.facetBadgeText, { color: theme.background }]}>
                                        {filters[facet].size}
                                    </ThemedText>
                                </View>
                            ) : null}
                            <Ionicons name="chevron-forward" size={16} color={theme.iconColor} />
                        </View>
                    </Pressable>
                ))}
            </Sheet>

            <ExerciseInfoModal exercise={infoExercise} onClose={() => setInfoExercise(null)} />
        </Modal>
    )
}

export default ExercisePicker

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: Space.xl,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Space.md,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm + 2,
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Space.lg,
        height: 46,
    },
    searchInput: {
        flex: 1,
        padding: 0,
    },
    facetsRow: {
        flexDirection: 'row',
        gap: Space.sm - 1,
    },
    facetPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.xs + 1,
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: Space.md,
        paddingVertical: Space.sm,
    },
    overflowPill: {
        paddingHorizontal: Space.sm + 2,
    },
    facetLabel: {
        fontWeight: '600',
    },
    facetBadge: {
        minWidth: 15,
        alignItems: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    overflowBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
    },
    facetBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    chipsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Space.md,
    },
    chipsWrap: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Space.xs + 2,
    },
    activeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.xs,
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingVertical: Space.xs,
        paddingLeft: Space.sm + 2,
        paddingRight: Space.sm - 1,
    },
    countText: {
        flexShrink: 0,
    },
    countNumber: {
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    divider: {
        height: 1,
    },
    listContent: {
        paddingBottom: Space.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.md,
        paddingVertical: Space.md + 1,
        paddingHorizontal: Space.lg - 2,
    },
    rowUnselected: {
        borderRadius: Radius.card,
    },
    // Flat left edge, rounded right - the same shape a ticked live-session Set
    // row takes (ExerciseSetEditor's liveRowTicked), so "this is chosen" reads
    // the same wherever the app marks it.
    rowSelected: {
        borderLeftWidth: 2,
        borderTopRightRadius: Radius.card,
        borderBottomRightRadius: Radius.card,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
        gap: Space.xs - 1,
    },
    rowNameLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.xs + 2,
    },
    rowNameText: {
        flexShrink: 1,
    },
    control: {
        width: 32,
        height: 32,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    empty: {
        paddingVertical: Space.xxl * 1.5,
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
    },
    addLink: {
        fontWeight: '600',
    },
    footerAdd: {
        paddingTop: Space.md,
        alignItems: 'center',
    },
    footer: {
        borderTopWidth: 1,
        paddingTop: Space.md,
        paddingBottom: Space.lg,
    },
    // The gated custom-exercise form's own chips - deliberately plainer than
    // the catalog's facet chips above, since this path stays unreachable while
    // CUSTOM_EXERCISES_ENABLED is false and doesn't earn the same polish.
    legacyChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Space.sm,
    },
    legacyChip: {
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingVertical: Space.xs + 2,
        paddingHorizontal: Space.md,
    },
    sheet: {
        maxHeight: '75%',
    },
    sheetHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    // A fixed cap rather than a flex share of the sheet: the sheet itself
    // sizes to its content up to styles.sheet's own maxHeight, and Equipment
    // alone is 33 rows - this is what makes the list scroll internally
    // instead of the whole sheet trying to grow past the screen.
    sheetList: {
        maxHeight: 360,
    },
    sheetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
        gap: Space.md,
    },
    sheetCheck: {
        width: 22,
        height: 22,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overflowRowTrail: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Space.sm,
    },
})
