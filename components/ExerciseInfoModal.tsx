import { Modal, ScrollView, StyleSheet, useColorScheme, View } from 'react-native'
import Pressable from './Touchable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import ThemedText from './ThemedText'
import SectionLabel from './SectionLabel'
import VideoEmbed from './VideoEmbed'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { fieldsFor, tagValues, titleCase } from '../utils/exerciseSearch'

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
        <View style={[styles.chip, { backgroundColor: theme.uiBackground, borderColor: theme.line }]}>
            {icon ? <Ionicons name={icon} size={13} color={theme.iconColor} /> : null}
            <ThemedText variant="small" tone="body">{label}</ThemedText>
        </View>
    )

    const Section = ({ title, children }) => (
        <View style={styles.section}>
            <SectionLabel style={styles.sectionLabel}>{title}</SectionLabel>
            <View style={styles.chipRow}>{children}</View>
        </View>
    )

    return (
        <Modal visible animationType="slide" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[
                    styles.header,
                    { paddingTop: insets.top + 8, borderBottomColor: theme.line },
                ]}>
                    <Pressable
                        onPress={onClose}
                        // 44pt is the smallest reliable one-thumb target; the icon is
                        // smaller than that, so the padding does the work.
                        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Back to exercise list"
                    >
                        <Ionicons name="chevron-back" size={24} color={theme.iconColorFocused} />
                        <ThemedText variant="body" tone="accent" style={styles.backText}>Back</ThemedText>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <ThemedText variant="heading" tone="title">{exercise.name}</ThemedText>
                    {role ? (
                        <View style={styles.roleRow}>
                            <View style={[styles.roleDot, { backgroundColor: theme.iconColorFocused }]} />
                            <ThemedText variant="small" tone="muted">
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
                                <ThemedText variant="small" tone="muted">
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
        borderBottomWidth: 1,
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
        fontWeight: '600',
    },
    body: {
        paddingHorizontal: Space.xl,
        paddingTop: Space.xl,
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
    videoWrap: {
        marginTop: Space.xl,
    },
    noVideo: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: Radius.hero,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Space.sm,
    },
    section: {
        marginTop: Space.xxl,
    },
    sectionLabel: {
        marginBottom: Space.md,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Space.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingVertical: Space.sm,
        paddingHorizontal: Space.md + 1,
    },
})

export default ExerciseInfoModal
