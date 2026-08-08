import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import ThemedButton from './ThemedButton'
import ExerciseInfoModal from './ExerciseInfoModal'
import Spacer from './Spacer'
import { Colors } from '../constants/Colors'
import { buildIndex, roleOf, searchExercises } from '../utils/exerciseSearch'
import { useAuth } from '../contexts/AuthContext'
import { useCustomExercises } from '../hooks/useCustomExercises'

// The `role:` facet - what job a movement does in a session. Kept in sync with
// ROLES in scripts/exerciseVocab.js.
const ROLE_LABELS = {
    compound: 'Compound',
    accessory: 'Accessory',
    isolation: 'Isolation',
    power: 'Power',
    potentiation: 'Potentiation',
    core: 'Core',
    prehab: 'Prehab',
    warmup: 'Warmup',
    cooldown: 'Cooldown',
    conditioning: 'Conditioning',
}

const FILTERS = ['all', 'compound', 'accessory', 'core', 'prehab', 'warmup', 'conditioning']

// The trainer picks how the exercise is measured, which decides both the `fields`
// stored on the doc and which inputs a client sees when logging it.
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
 * Select-only exercise chooser. Clients pick from the repository rather than
 * typing a name, so logged exercises always resolve to a known id - which is what
 * makes history lookup and cross-client reporting possible. Trainers additionally
 * get an "add to library" path for movements the bundled repository lacks.
 */
const ExercisePicker = ({ visible, onSelect, onClose }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    // See ExerciseInfoModal: real insets rather than a hardcoded top padding.
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { customExercises, addCustomExercise } = useCustomExercises(profile)

    const isTrainer = profile?.role === 'trainer'

    const [query, setQuery] = useState('')
    const [role, setRole] = useState('all')
    const [adding, setAdding] = useState(false)
    const [newMeasurement, setNewMeasurement] = useState(MEASUREMENT_OPTIONS[0].label)
    const [newRole, setNewRole] = useState('accessory')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    // The exercise whose how-to page is open, layered over this picker.
    const [infoExercise, setInfoExercise] = useState(null)

    const customIndex = useMemo(() => buildIndex(customExercises), [customExercises])

    const results = useMemo(() => {
        const found = searchExercises(query, 200, customIndex)
        return role === 'all' ? found : found.filter((e) => roleOf(e) === role)
    }, [query, role, customIndex])

    const reset = () => {
        setQuery('')
        setRole('all')
        setAdding(false)
        setError('')
        setNewMeasurement(MEASUREMENT_OPTIONS[0].label)
        setNewRole('accessory')
        setInfoExercise(null)
    }

    const handleSelect = (exercise) => {
        reset()
        onSelect(exercise)
    }

    const handleClose = () => {
        reset()
        onClose()
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
            style={[
                styles.filterChip,
                { borderColor: active ? Colors.primary : theme.iconColor },
                active && { backgroundColor: Colors.primary },
            ]}
        >
            <ThemedText style={[styles.filterText, active && { color: '#fff' }]}>{label}</ThemedText>
        </Pressable>
    )

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
            <View style={[
                styles.container,
                {
                    backgroundColor: theme.background,
                    paddingTop: insets.top + 12,
                    // The list scrolls under the home indicator without this.
                    paddingBottom: insets.bottom,
                },
            ]}>
                <View style={styles.headerRow}>
                    <ThemedText style={styles.heading}>{adding ? 'Add Exercise' : 'Choose Exercise'}</ThemedText>
                    <Pressable onPress={adding ? () => setAdding(false) : handleClose} hitSlop={10}>
                        <ThemedText style={{ color: Colors.primary, fontWeight: 'bold' }}>
                            {adding ? 'Back' : 'Cancel'}
                        </ThemedText>
                    </Pressable>
                </View>

                <Spacer height={12} />
                <ThemedTextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={adding ? 'Exercise name' : 'Search exercises'}
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize={adding ? 'words' : 'none'}
                />

                {adding ? (
                    <>
                        <Spacer height={16} />
                        <ThemedText style={styles.label}>How is it measured?</ThemedText>
                        <Spacer height={8} />
                        <View style={styles.filterRow}>
                            {MEASUREMENT_OPTIONS.map((option) =>
                                renderChip(option.label, newMeasurement === option.label, () =>
                                    setNewMeasurement(option.label)
                                )
                            )}
                        </View>

                        <Spacer height={16} />
                        <ThemedText style={styles.label}>Role</ThemedText>
                        <Spacer height={8} />
                        <View style={styles.filterRow}>
                            {NEW_ROLE_OPTIONS.map((value) =>
                                renderChip(ROLE_LABELS[value], newRole === value, () => setNewRole(value))
                            )}
                        </View>

                        {error ? (
                            <>
                                <Spacer height={16} />
                                <ThemedText style={{ color: Colors.warning }}>{error}</ThemedText>
                            </>
                        ) : null}

                        <Spacer height={20} />
                        <ThemedButton onPress={handleAdd} disabled={saving}>
                            <ThemedText style={styles.saveBtnText}>
                                {saving ? 'Adding...' : 'Add to Library'}
                            </ThemedText>
                        </ThemedButton>
                    </>
                ) : (
                    <>
                        <Spacer height={10} />
                        <View style={styles.filterRow}>
                            {FILTERS.map((key) =>
                                renderChip(key === 'all' ? 'All' : ROLE_LABELS[key], role === key, () =>
                                    setRole(key)
                                )
                            )}
                        </View>

                        <Spacer height={10} />
                        <FlatList
                            data={results}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <ThemedText>No exercise matches "{query}".</ThemedText>
                                    <Spacer height={6} />
                                    <ThemedText style={styles.emptyHint}>
                                        {isTrainer
                                            ? 'Add it to the library so your clients can log it.'
                                            : 'Ask your trainer to add it to the library.'}
                                    </ThemedText>
                                    {isTrainer ? (
                                        <>
                                            <Spacer height={16} />
                                            <Pressable onPress={() => setAdding(true)}>
                                                <ThemedText style={styles.addLink}>
                                                    + Add "{query.trim()}"
                                                </ThemedText>
                                            </Pressable>
                                        </>
                                    ) : null}
                                </View>
                            }
                            renderItem={({ item }) => (
                                <Pressable
                                    onPress={() => handleSelect(item)}
                                    style={({ pressed }) => [
                                        styles.row,
                                        { borderBottomColor: theme.uiBackground },
                                        pressed && { backgroundColor: theme.uiBackground },
                                    ]}
                                >
                                    <View style={styles.rowText}>
                                        <ThemedText style={styles.rowName}>
                                            {item.name}
                                            {item.isCustom ? (
                                                <ThemedText style={[styles.customTag, { color: Colors.primary }]}>
                                                    {'  '}Custom
                                                </ThemedText>
                                            ) : null}
                                        </ThemedText>
                                        <ThemedText style={[styles.rowRole, { color: theme.iconColor }]}>
                                            {ROLE_LABELS[roleOf(item)] ?? ''}
                                        </ThemedText>
                                    </View>
                                    {/* Its own Pressable, so opening the how-to does not also
                                        select the exercise and dismiss the picker. */}
                                    <Pressable
                                        onPress={() => setInfoExercise(item)}
                                        hitSlop={8}
                                        style={[styles.infoBtn, { borderColor: Colors.primary }]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`How to do ${item.name}`}
                                    >
                                        <Ionicons name="information" size={16} color={Colors.primary} />
                                    </Pressable>
                                </Pressable>
                            )}
                        />

                        {isTrainer && results.length > 0 ? (
                            <Pressable onPress={() => setAdding(true)} style={styles.footerAdd}>
                                <ThemedText style={styles.addLink}>+ Add a new exercise</ThemedText>
                            </Pressable>
                        ) : null}
                    </>
                )}
            </View>

            <ExerciseInfoModal exercise={infoExercise} onClose={() => setInfoExercise(null)} />
        </Modal>
    )
}

export default ExercisePicker

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heading: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    label: {
        fontSize: 14,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    filterText: {
        fontSize: 13,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    rowText: {
        flex: 1,
    },
    rowName: {
        fontSize: 16,
    },
    customTag: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    rowRole: {
        fontSize: 12,
        marginTop: 2,
    },
    infoBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyHint: {
        opacity: 0.7,
        fontSize: 13,
        textAlign: 'center',
    },
    addLink: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    footerAdd: {
        paddingTop: 12,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
