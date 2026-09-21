import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import ThemedView from '../../../../components/ThemedView'
import ThemedText from '../../../../components/ThemedText'
import ThemedTextInput from '../../../../components/ThemedTextInput'
import ThemedButton from '../../../../components/ThemedButton'
import OfflineBanner from '../../../../components/OfflineBanner'
import { PlaceholderRows } from '../../../../components/Placeholder'
import ScreenEnter from '../../../../components/ScreenEnter'
import ScreenSubtitle from '../../../../components/ScreenSubtitle'
import Spacer from '../../../../components/Spacer'
import SectionLabel from '../../../../components/SectionLabel'
import ExercisePicker from '../../../../components/ExercisePicker'
import ExerciseSetEditor from '../../../../components/ExerciseSetEditor'
import { Space, SCREEN_PADDING } from '../../../../constants/Layout'
import { FontFamily } from '../../../../constants/Type'
import { useAuth } from '../../../../contexts/AuthContext'
import { draftsFrom, useExerciseDraft } from '../../../../hooks/useExerciseDraft'
import { useLeave } from '../../../../hooks/useLeave'
import { useOffline } from '../../../../hooks/useOffline'
import {
    nextVersionNumber,
    publishTemplateVersion,
    useTemplateVersion,
    useWorkoutTemplate,
} from '../../../../hooks/useWorkoutTemplates'
import { storedSetFrom } from '../../../../utils/setDraft'

/**
 * Editing a Workout Template.
 *
 * The load is two reads: the Template holds identity and a pointer, the Version
 * it points at holds the contents. Saving does not write back to that Version -
 * it publishes a new one (ADR 0002), because Sessions cite the exact Version
 * they ran and rewriting it would silently change what a Client appears to have
 * been asked to do. The screen says so rather than leaving the Trainer to infer
 * it from a version number ticking over after the fact.
 *
 * Serves either author. A Workout Template is one kind of thing whoever wrote it,
 * so a Client editing their own saved routine gets this same screen and the same
 * versioning - the two differences are guarded below, and both are about
 * authorship rather than role: only the author may edit, and only a Trainer has
 * anyone to assign to.
 */
const EditWorkoutTemplate = () => {
    const { templateId } = useLocalSearchParams<{ templateId: string }>()
    const router = useRouter()
    const { profile } = useAuth()
    // As in templates/new: a Client only ever edits their own from Today, so
    // their back and publish go there; a Trainer's go down the Library.
    const { leave, fromToday } = useLeave({
        home: '/workouts/templates',
        homeLabel: 'Library',
        toToday: profile?.role !== 'trainer',
    })

    const {
        template,
        loading: templateLoading,
        offline: templateOffline,
        retry: retryTemplate,
    } = useWorkoutTemplate(templateId)
    const {
        version,
        loading: versionLoading,
        offline: versionOffline,
        retry: retryVersion,
    } = useTemplateVersion(templateId, template?.currentVersionId)
    const offline = useOffline(templateOffline, versionOffline)

    // Either read can be the one that timed out, and the banner offers a single
    // button, so retry means retry both.
    const retry = () => {
        retryTemplate()
        retryVersion()
    }

    const [name, setName] = useState('')
    const [pickerOpen, setPickerOpen] = useState(false)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    // Starts empty and is filled from the stored Version by the effect below;
    // an Exercise added afterwards gets the hook's default single blank row.
    const { exercises, setExercises, pickExercise, updateSet, addSet, removeSet, removeExercise } =
        useExerciseDraft()

    // Which Version the form on screen was filled from. The snapshot helper
    // subscribes with includeMetadataChanges, so a Version's document arrives
    // more than once (cache, then server confirmation) with identical contents;
    // without this guard the second delivery would wipe whatever the Trainer had
    // typed since the first. It also means publishing - which repoints the
    // Template at a new Version - correctly reloads the form from what was just
    // written, for the case where the navigation away doesn't happen.
    const [loadedVersionId, setLoadedVersionId] = useState(null)

    useEffect(() => {
        if (!version || version.id === loadedVersionId) return
        setName(template?.name ?? '')
        setExercises(draftsFrom(version.exercises))
        setLoadedVersionId(version.id)
    }, [version, template, loadedVersionId])

    const handlePickExercise = (exercise) => {
        setPickerOpen(false)
        pickExercise(exercise)
    }

    const currentVersion = template?.currentVersionNumber ?? 1
    const publishingVersion = nextVersionNumber(template?.currentVersionNumber)

    const handlePublish = async () => {
        setError('')

        const trimmedName = name.trim()
        if (!trimmedName) {
            setError('Give the template a name.')
            return
        }
        if (exercises.length === 0) {
            setError('Add at least one exercise.')
            return
        }

        const targetExercises = exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            fields: ex.fields,
            // Blank rows stand, exactly as when the Template was authored: the
            // number of target Sets is part of the prescription, so dropping an
            // empty row would quietly prescribe less work. storedSetFrom is the
            // one place a measurement becomes a number, and it stores an empty
            // box as null rather than 0.
            sets: ex.sets.map((set) => storedSetFrom(set, ex.fields)),
        }))

        setSaving(true)
        try {
            await publishTemplateVersion({
                templateId,
                name: trimmedName,
                exercises: targetExercises,
                currentVersionNumber: template?.currentVersionNumber,
            })
            leave()
        } catch (err) {
            setError(err.message || 'Failed to publish new version.')
            setSaving(false)
        }
    }

    // Only the author edits, and this is the affordance rather than the
    // enforcement - the rules refuse an update from anyone else, and refuse it
    // for both directions at once, since they test authorship and never a role.
    // A Client cannot open their Trainer's prescription and a Trainer cannot
    // open their Client's own routine, and both are denied by the same clause.
    //
    // Said plainly rather than by hiding the button: an assigned Client can read
    // this Template, so they may well arrive here from a link, and a form that
    // silently refuses to save is worse than one that says why.
    if (template && profile && template.authorId !== profile.uid) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText variant="heading" tone="title">
                    {template.name}
                </ThemedText>
                <Spacer height={Space.sm} />
                <ThemedText variant="meta" tone="muted">
                    This workout belongs to whoever wrote it, and only they can change it. Yours are the ones
                    under &quot;Your own&quot;.
                </ThemedText>
            </ThemedView>
        )
    }

    // The Version is loaded before the form exists, so there is nothing to show
    // and nothing safe to save until it arrives.
    if (!loadedVersionId) {
        return (
            <ThemedView style={styles.container}>
                <OfflineBanner visible={offline} onRetry={retry} />
                {/* A Version already here is one the effect above is about to
                    load into the form, not a missing one - without `version` in
                    this test the failure copy painted for that frame. */}
                {templateLoading || versionLoading || version ? (
                    <PlaceholderRows />
                ) : (
                    <ThemedText variant="body" tone="muted">
                        This template isn&apos;t available.
                    </ThemedText>
                )}
            </ThemedView>
        )
    }

    return (
        <ThemedView style={styles.container}>
            <ScreenEnter play={fromToday}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <OfflineBanner visible={offline} onRetry={retry} />

                    {/* Which Version is live right now, and therefore what anyone
                        starting this workout gets. Worded for either author: a
                        Client editing their own routine has no clients to speak of,
                        and telling them otherwise would be nonsense. */}
                    <ScreenSubtitle>
                        Editing · currently v{currentVersion} —{' '}
                        {profile?.role === 'trainer'
                            ? 'the version your clients see now'
                            : 'the version you start now'}
                    </ScreenSubtitle>

                    {/* Assigning is reached from the Template, because "who is doing
                        this workout?" is a question about this Template and nothing
                        else. It leaves unsaved edits behind, which is correct: an
                        Assignment points at the Template, not at a draft.
                    
                        Trainers only, and not because a Client is forbidden to
                        prescribe - the rules would deny it - but because a Client
                        has no clients, so the roster behind this link is empty by
                        construction. A Client's own Template is simply not
                        prescribed. */}
                    {profile?.role === 'trainer' ? (
                        <>
                            <Pressable onPress={() => router.push(`/workouts/templates/assign/${templateId}`)}>
                                <ThemedText tone="accent" style={styles.addLink}>
                                    Assign to clients →
                                </ThemedText>
                            </Pressable>
                            <Spacer height={Space.lg} />
                        </>
                    ) : null}

                    <ThemedText variant="meta" tone="muted" style={styles.label}>
                        Name
                    </ThemedText>
                    <ThemedTextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Upper Body A"
                        autoCapitalize="words"
                        editable={!saving}
                    />

                    <Spacer height={Space.xl} />
                    <SectionLabel>EXERCISES</SectionLabel>

                    {exercises.length === 0 ? (
                        <>
                            <Spacer height={Space.sm} />
                            <ThemedText variant="meta" tone="muted">
                                Add an exercise from the catalog, then set the targets for each set.
                            </ThemedText>
                        </>
                    ) : null}

                    {exercises.map((exercise, exIndex) => (
                        <View key={`${exercise.exerciseId}-${exIndex}`}>
                            <Spacer height={Space.md} />
                            <ExerciseSetEditor
                                name={exercise.name}
                                fields={exercise.fields}
                                sets={exercise.sets}
                                hint="Targets - blank where a measurement doesn't apply"
                                editable={!saving}
                                onChangeSet={(setIndex, field, value) => updateSet(exIndex, setIndex, field, value)}
                                onAddSet={() => addSet(exIndex)}
                                onRemoveSet={(setIndex) => removeSet(exIndex, setIndex)}
                                onRemoveExercise={() => removeExercise(exIndex)}
                            />
                        </View>
                    ))}

                    <Spacer height={Space.md} />
                    <Pressable onPress={() => setPickerOpen(true)} disabled={saving}>
                        <ThemedText tone="accent" style={styles.addLink}>
                            + Add Exercise
                        </ThemedText>
                    </Pressable>

                    {error ? (
                        <>
                            <Spacer height={Space.lg} />
                            <ThemedText variant="body" tone="danger">
                                {error}
                            </ThemedText>
                        </>
                    ) : null}

                    <Spacer height={Space.xxl} />
                    {/* Spelled out, not implied. Progressing a workout and correcting
                        a typo take the same keystrokes here, and only one of them is
                        what the Trainer means - so the screen names the version being
                        published and promises the old one is untouched, which is the
                        promise a Client's history rests on. */}
                    <ThemedText variant="meta" tone="muted" style={styles.publishNote}>
                        Saving publishes version{' '}
                        <ThemedText tone="title" style={styles.publishVersion}>
                            {publishingVersion}
                        </ThemedText>
                        . Version {currentVersion} stays exactly as it is, so sessions already performed against it keep
                        their meaning.
                    </ThemedText>

                    <Spacer height={Space.sm + 2} />
                    <ThemedButton onPress={handlePublish} disabled={saving}>
                        <ThemedText variant="cardTitle" tone="onPrimary">
                            {saving ? 'Publishing...' : 'Publish new version'}
                        </ThemedText>
                    </ThemedButton>
                    <Spacer height={Space.xl} />
                </ScrollView>
            </ScreenEnter>

            <ExercisePicker
                visible={pickerOpen}
                onSelect={handlePickExercise}
                onClose={() => setPickerOpen(false)}
            />
        </ThemedView>
    )
}

export default EditWorkoutTemplate

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SCREEN_PADDING,
    },
    scrollContent: {
        paddingBottom: Space.xl,
    },
    label: {
        marginBottom: Space.xs + 2,
    },
    addLink: {
        fontFamily: FontFamily.label,
        fontSize: 12,
    },
    publishNote: {
        textAlign: 'center',
        lineHeight: 18,
    },
    publishVersion: {
        fontFamily: FontFamily.label,
        fontSize: 12,
    },
})
