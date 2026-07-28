import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, useColorScheme, View } from 'react-native'

import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import ThemedButton from './ThemedButton'
import Spacer from './Spacer'
import { Colors } from '../constants/Colors'
import { buildIndex, searchExercises } from '../utils/exerciseSearch'
import { useAuth } from '../contexts/AuthContext'
import { useCustomExercises } from '../hooks/useCustomExercises'

const CATEGORY_LABELS = {
    compound: 'Compound',
    accessory: 'Accessory',
    isolation: 'Isolation',
    mobility: 'Mobility',
    cardio: 'Cardio',
    core: 'Core',
    power: 'Power',
    other: 'Other',
}

const FILTERS = ['all', 'compound', 'accessory', 'mobility', 'cardio']

// Mirrors fieldsForType - the trainer picks how the exercise is measured, which
// decides which inputs a client sees when logging it.
const TYPE_OPTIONS = [
    { value: 'weight_reps', label: 'Weight + reps' },
    { value: 'bodyweight_reps', label: 'Reps only' },
    { value: 'duration', label: 'Time' },
    { value: 'distance_duration', label: 'Distance + time' },
]

const NEW_CATEGORY_OPTIONS = ['compound', 'accessory', 'isolation', 'mobility', 'cardio', 'core', 'power']

/**
 * Select-only exercise chooser. Clients pick from the repository rather than
 * typing a name, so logged exercises always resolve to a known id - which is what
 * makes history lookup and cross-client reporting possible. Trainers additionally
 * get an "add to library" path for movements the bundled repository lacks.
 */
const ExercisePicker = ({ visible, onSelect, onClose }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { profile } = useAuth()
    const { customExercises, addCustomExercise } = useCustomExercises(profile)

    const isTrainer = profile?.role === 'trainer'

    const [query, setQuery] = useState('')
    const [category, setCategory] = useState('all')
    const [adding, setAdding] = useState(false)
    const [newType, setNewType] = useState('weight_reps')
    const [newCategory, setNewCategory] = useState('accessory')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const customIndex = useMemo(() => buildIndex(customExercises), [customExercises])

    const results = useMemo(() => {
        const found = searchExercises(query, 200, customIndex)
        return category === 'all' ? found : found.filter((e) => e.category === category)
    }, [query, category, customIndex])

    const reset = () => {
        setQuery('')
        setCategory('all')
        setAdding(false)
        setError('')
        setNewType('weight_reps')
        setNewCategory('accessory')
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
            await addCustomExercise({ name, type: newType, category: newCategory })
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
            <View style={[styles.container, { backgroundColor: theme.background }]}>
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
                            {TYPE_OPTIONS.map((option) =>
                                renderChip(option.label, newType === option.value, () => setNewType(option.value))
                            )}
                        </View>

                        <Spacer height={16} />
                        <ThemedText style={styles.label}>Category</ThemedText>
                        <Spacer height={8} />
                        <View style={styles.filterRow}>
                            {NEW_CATEGORY_OPTIONS.map((value) =>
                                renderChip(CATEGORY_LABELS[value], newCategory === value, () => setNewCategory(value))
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
                                renderChip(key === 'all' ? 'All' : CATEGORY_LABELS[key], category === key, () =>
                                    setCategory(key)
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
                                        {item.aliases?.length ? (
                                            <ThemedText style={styles.rowAlias}>
                                                aka {item.aliases.join(', ')}
                                            </ThemedText>
                                        ) : null}
                                    </View>
                                    <ThemedText style={[styles.rowCategory, { color: theme.iconColor }]}>
                                        {CATEGORY_LABELS[item.category] ?? item.category}
                                    </ThemedText>
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
        </Modal>
    )
}

export default ExercisePicker

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        paddingTop: 60,
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
    rowAlias: {
        fontSize: 12,
        opacity: 0.6,
        marginTop: 2,
    },
    rowCategory: {
        fontSize: 12,
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
