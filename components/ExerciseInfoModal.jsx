import { Modal, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import VideoEmbed from './VideoEmbed'
import Spacer from './Spacer'
import { Colors } from '../constants/Colors'
import { fieldsFor, tagValues } from '../utils/exerciseSearch'

const FIELD_LABELS = {
    weightKg: 'Weight',
    reps: 'Reps',
    distanceMeters: 'Distance',
    durationSeconds: 'Time',
}

const titleCase = (value) =>
    value.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/**
 * The how-to page for one exercise, reached from the info button in the picker.
 *
 * It is a stacked modal rather than a pushed route on purpose: the picker is
 * itself a Modal, and on native a Modal sits above the navigator, so a pushed
 * screen would open *behind* it. Layering keeps the client's search and filter
 * state intact underneath, so closing this returns them exactly where they were.
 */
const ExerciseInfoModal = ({ exercise, onClose }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    if (!exercise) return null

    const muscles = tagValues(exercise, 'muscle')
    const equipment = tagValues(exercise, 'equipment')
    const role = tagValues(exercise, 'role')[0]

    return (
        <Modal visible animationType="slide" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.headerRow}>
                    <Pressable onPress={onClose} hitSlop={10} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
                        <ThemedText style={{ color: Colors.primary, fontWeight: 'bold' }}>Back</ThemedText>
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.body}>
                    <ThemedText style={styles.name}>{exercise.name}</ThemedText>
                    {role ? (
                        <ThemedText style={[styles.role, { color: theme.iconColor }]}>
                            {titleCase(role)}
                        </ThemedText>
                    ) : null}

                    <Spacer height={16} />
                    {exercise.videoUrl ? (
                        <VideoEmbed url={exercise.videoUrl} />
                    ) : (
                        <View style={[styles.noVideo, { borderColor: theme.iconColor }]}>
                            <Ionicons name="videocam-off-outline" size={22} color={theme.iconColor} />
                            <Spacer height={6} />
                            <ThemedText style={{ color: theme.iconColor, fontSize: 13 }}>
                                No how-to video for this one yet.
                            </ThemedText>
                        </View>
                    )}

                    <Spacer height={20} />
                    {muscles.length ? (
                        <>
                            <ThemedText style={styles.label}>Trains</ThemedText>
                            <ThemedText style={styles.value}>{muscles.map(titleCase).join(', ')}</ThemedText>
                            <Spacer height={12} />
                        </>
                    ) : null}

                    {equipment.length ? (
                        <>
                            <ThemedText style={styles.label}>Equipment</ThemedText>
                            <ThemedText style={styles.value}>{equipment.map(titleCase).join(', ')}</ThemedText>
                            <Spacer height={12} />
                        </>
                    ) : null}

                    <ThemedText style={styles.label}>Logged as</ThemedText>
                    <ThemedText style={styles.value}>
                        {fieldsFor(exercise).map((f) => FIELD_LABELS[f] ?? f).join(' + ')}
                    </ThemedText>
                </ScrollView>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -6,
    },
    body: {
        paddingTop: 16,
        paddingBottom: 40,
    },
    name: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    role: {
        fontSize: 13,
        marginTop: 2,
    },
    noVideo: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 12,
        opacity: 0.6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 15,
        marginTop: 2,
    },
})

export default ExerciseInfoModal
