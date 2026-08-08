import { Modal, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import VideoEmbed from './VideoEmbed'
import { Colors } from '../constants/Colors'
import { fieldsFor, tagValues } from '../utils/exerciseSearch'

const FIELD_LABELS = {
    weightKg: 'Weight',
    reps: 'Reps',
    distanceMeters: 'Distance',
    durationSeconds: 'Time',
}

const FIELD_ICONS = {
    weightKg: 'barbell-outline',
    reps: 'repeat-outline',
    distanceMeters: 'trail-sign-outline',
    durationSeconds: 'stopwatch-outline',
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
 *
 * Laid out for a phone held one-handed mid-set: the video is the first thing on
 * screen, and everything below it is glanceable rather than read.
 */
const ExerciseInfoModal = ({ exercise, onClose }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    // Real device insets rather than a hardcoded padding - a Dynamic Island needs
    // more room than a status bar, and Android varies again. Zero on web.
    const insets = useSafeAreaInsets()

    if (!exercise) return null

    const muscles = tagValues(exercise, 'muscle')
    const equipment = tagValues(exercise, 'equipment')
    const role = tagValues(exercise, 'role')[0]
    const fields = fieldsFor(exercise)

    const Chip = ({ label, icon }: { label: string, icon?: any }) => (
        <View style={[styles.chip, { backgroundColor: theme.uiBackground }]}>
            {icon ? <Ionicons name={icon} size={13} color={theme.iconColor} /> : null}
            <ThemedText style={styles.chipText}>{label}</ThemedText>
        </View>
    )

    const Section = ({ title, children }) => (
        <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: theme.iconColor }]}>{title}</ThemedText>
            <View style={styles.chipRow}>{children}</View>
        </View>
    )

    return (
        <Modal visible animationType="slide" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[
                    styles.header,
                    { paddingTop: insets.top + 8, borderBottomColor: theme.uiBackground },
                ]}>
                    <Pressable
                        onPress={onClose}
                        // 44pt is the smallest reliable one-thumb target; the icon is
                        // smaller than that, so the padding does the work.
                        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Back to exercise list"
                    >
                        <Ionicons name="chevron-back" size={26} color={Colors.primary} />
                        <ThemedText style={styles.backText}>Back</ThemedText>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <ThemedText style={styles.name}>{exercise.name}</ThemedText>
                    {role ? (
                        <View style={styles.roleRow}>
                            <View style={[styles.roleDot, { backgroundColor: Colors.primary }]} />
                            <ThemedText style={[styles.role, { color: theme.iconColor }]}>
                                {titleCase(role)}
                            </ThemedText>
                        </View>
                    ) : null}

                    <View style={styles.videoWrap}>
                        {exercise.videoUrl ? (
                            <VideoEmbed url={exercise.videoUrl} clip={exercise.clip} />
                        ) : (
                            <View style={[styles.noVideo, { backgroundColor: theme.uiBackground }]}>
                                <Ionicons name="videocam-off-outline" size={26} color={theme.iconColor} />
                                <ThemedText style={[styles.noVideoText, { color: theme.iconColor }]}>
                                    No how-to video for this one yet.
                                </ThemedText>
                            </View>
                        )}
                    </View>

                    {muscles.length ? (
                        <Section title="Trains">
                            {muscles.map((m) => <Chip key={m} label={titleCase(m)} />)}
                        </Section>
                    ) : null}

                    {equipment.length ? (
                        <Section title="Equipment">
                            {equipment.map((e) => <Chip key={e} label={titleCase(e)} />)}
                        </Section>
                    ) : null}

                    <Section title="Logged as">
                        {fields.map((f) => (
                            <Chip key={f} label={FIELD_LABELS[f] ?? f} icon={FIELD_ICONS[f]} />
                        ))}
                    </Section>
                </ScrollView>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 12,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        minHeight: 44,
        paddingRight: 16,
        gap: 2,
    },
    backText: {
        color: Colors.primary,
        fontWeight: '600',
        fontSize: 17,
    },
    body: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    name: {
        fontSize: 26,
        fontWeight: '700',
        lineHeight: 32,
    },
    roleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    roleDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    role: {
        fontSize: 14,
    },
    videoWrap: {
        marginTop: 20,
    },
    noVideo: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    noVideoText: {
        fontSize: 13,
    },
    section: {
        marginTop: 24,
    },
    sectionLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: '600',
        marginBottom: 10,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 13,
    },
    chipText: {
        fontSize: 14,
    },
})

export default ExerciseInfoModal
