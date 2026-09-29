import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'

import ThemedView from '../../../../../../components/ThemedView'
import ThemedText from '../../../../../../components/ThemedText'
import ThemedButton from '../../../../../../components/ThemedButton'
import ThemedCard from '../../../../../../components/ThemedCard'
import OfflineBanner from '../../../../../../components/OfflineBanner'
import { PlaceholderRows } from '../../../../../../components/Placeholder'
import ScreenSubtitle from '../../../../../../components/ScreenSubtitle'
import Spacer from '../../../../../../components/Spacer'
import ExerciseSetEditor from '../../../../../../components/ExerciseSetEditor'
import FieldError from '../../../../../../components/FieldError'
import { showToast } from '../../../../../../components/Toast'
import { Space, SCREEN_PADDING } from '../../../../../../constants/Layout'
import { useAuth } from '../../../../../../contexts/AuthContext'
import { useClients } from '../../../../../../hooks/useClients'
import { draftsFrom, useExerciseDraft } from '../../../../../../hooks/useExerciseDraft'
import { useOffline } from '../../../../../../hooks/useOffline'
import { setTargetOverrides, useAssignment } from '../../../../../../hooks/useAssignments'
import { useTemplateVersion, useWorkoutTemplate } from '../../../../../../hooks/useWorkoutTemplates'
import { summariseSets } from '../../../../../../utils/formatSet'
import { resolveTargets, targetOverridesFrom } from '../../../../../../utils/prescription'
import { storedSetFrom } from '../../../../../../utils/setDraft'

/**
 * What the Template asks of everyone, said in one line beside what this Client
 * gets. Said out loud when it asks for nothing, because a Trainer looking at an
 * empty box needs to know whether that is this Client's doing or the plan's.
 */
const templateSummary = (sets) => {
    const summary = summariseSets(sets)
    return summary ? `Template target ${summary}` : 'The template sets no target'
}

/**
 * One Client's own target loads on one Workout Template.
 *
 * The reason an Assignment is a record rather than a list of names: the same
 * workout is right for every Client except the weights (ADR 0004). What is typed
 * here lands on this Client's Assignment and is seen by nobody else; the
 * Template is untouched, so no other Client's numbers move.
 *
 * The Exercises and the number of Sets are deliberately fixed - they are the
 * Template's, shared with everyone assigned it, and changing them is publishing
 * a new Version rather than adjusting one person. So the editor is handed no
 * add/remove callbacks and renders no controls for them.
 */
const ClientTargets = () => {
    const { templateId, clientId } = useLocalSearchParams<{ templateId: string; clientId: string }>()
    const router = useRouter()
    const { profile } = useAuth()

    const { template, loading: templateLoading, offline: templateOffline, retry: retryTemplate } =
        useWorkoutTemplate(templateId)
    const { version, loading: versionLoading, offline: versionOffline, retry: retryVersion } =
        useTemplateVersion(templateId, template?.currentVersionId)
    const {
        assignment,
        loading: assignmentLoading,
        offline: assignmentOffline,
        retry: retryAssignment,
    } = useAssignment(templateId, clientId)
    const { clients, offline: clientsOffline, retry: retryClients } = useClients(
        profile?.role === 'trainer' ? profile.uid : null
    )

    const offline = useOffline(templateOffline, versionOffline, assignmentOffline, clientsOffline)

    // Four reads behind one banner button: any of them can be the one that timed
    // out and the Trainer cannot tell which.
    const retry = () => {
        retryTemplate()
        retryVersion()
        retryAssignment()
        retryClients()
    }

    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const { exercises, setExercises, updateSet } = useExerciseDraft()

    // Which Version the form was filled from, for the same reason the Template
    // editor keeps one: the snapshot helper subscribes with
    // includeMetadataChanges, so both documents arrive more than once with
    // identical contents, and re-seeding on the second delivery would wipe
    // whatever the Trainer had typed since the first.
    const [loadedVersionId, setLoadedVersionId] = useState(null)

    // Seeded from what this Client actually sees today - their own targets where
    // they have them, the Template's everywhere else - so a Trainer adjusting one
    // number is not made to retype the rest. Waiting on the Assignment matters:
    // seeding from the Template alone and then saving would overwrite every
    // override this Client already had with the shared plan's numbers.
    useEffect(() => {
        if (!version || assignmentLoading || version.id === loadedVersionId) return
        setExercises(draftsFrom(resolveTargets(version, assignment)))
        setLoadedVersionId(version.id)
    }, [version, assignment, assignmentLoading, loadedVersionId])

    const client = clients.find((row) => row.uid === clientId)

    // Bounced rather than shown an editor whose save the rules would refuse.
    if (profile && profile.role !== 'trainer') {
        return <Redirect href="/workouts" />
    }

    // Back to the shared plan in one tap. Typing the Template's numbers back in
    // by hand reaches the same place - utils/prescription stores no override for
    // an Exercise that matches - but nobody should have to.
    //
    // Undoable, because it overwrites every box on the screen in one tap and
    // sat as a small link beside Save: the toast offers the numbers back.
    const resetToTemplate = () => {
        setError('')
        const before = exercises
        setExercises(draftsFrom(version?.exercises))
        showToast("Reset to the template's targets. Not saved yet.", {
            label: 'Undo',
            onPress: () => setExercises(before),
        })
    }

    const handleSave = async () => {
        setError('')

        const targets = exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            fields: exercise.fields,
            // storedSetFrom is the one place a measurement becomes a number, and
            // it stores an emptied box as null rather than 0 - so clearing a
            // Client's weight prescribes a bodyweight movement, not a 0 kg one.
            sets: exercise.sets.map((set) => storedSetFrom(set, exercise.fields)),
        }))

        setSaving(true)
        try {
            await setTargetOverrides({
                templateId,
                clientId,
                // Which of these count as overrides at all is the prescription
                // module's call, not this screen's.
                targetOverrides: targetOverridesFrom(version, targets),
            })
            router.back()
            showToast(`${client?.name ? `${client.name}'s` : 'Their'} targets saved`)
        } catch (err) {
            setError(err.message || 'Could not save these targets. Try again.')
            setSaving(false)
        }
    }

    // Nothing safe to edit and nothing safe to save until the plan is here: a
    // form seeded from a half-read Version would save that half over this
    // Client's real targets.
    if (!loadedVersionId) {
        return (
            <ThemedView style={styles.container}>
                <OfflineBanner visible={offline} onRetry={retry} />
                {/* `version` for the same reason as the Template editor: one
                    that has arrived is about to be loaded, not missing. */}
                {templateLoading || versionLoading || assignmentLoading || version ? (
                    <PlaceholderRows />
                ) : (
                    <ThemedText variant="body" tone="muted">
                        This client&apos;s targets aren&apos;t available.
                    </ThemedText>
                )}
            </ThemedView>
        )
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <OfflineBanner visible={offline} onRetry={retry} />

                {/* One title - the header's - with who and what under it. A
                    second, larger heading here read as a second screen title. */}
                <ScreenSubtitle style={styles.subtitle}>
                    For {client?.name ?? 'this client'} · {template?.name} v{template?.currentVersionNumber ?? 1}
                </ScreenSubtitle>

                <Spacer height={Space.lg} />
                {/* Said before the numbers, not discovered after them: this is
                    the one screen in the feature whose edits are for one person,
                    and it looks exactly like the Template editor. */}
                <ThemedCard style={styles.note}>
                    <ThemedText variant="meta" tone="muted">
                        These loads are {client?.name ? `${client.name}'s` : 'this client’s'} alone. The template
                        keeps its own targets and your other clients keep theirs.
                    </ThemedText>
                </ThemedCard>

                {exercises.map((exercise, exIndex) => (
                    <View key={`${exercise.exerciseId}-${exIndex}`}>
                        <Spacer height={Space.xl} />
                        {/* The hint is matched to the Version by position, which
                            is safe here and only here: these rows were seeded
                            straight from resolveTargets, which walks the
                            Version's own Exercises in order and returns one row
                            for each. */}
                        <ExerciseSetEditor
                            name={exercise.name}
                            fields={exercise.fields}
                            sets={exercise.sets}
                            hint={templateSummary(version?.exercises?.[exIndex]?.sets)}
                            editable={!saving}
                            onChangeSet={(setIndex, field, value) => updateSet(exIndex, setIndex, field, value)}
                        />
                    </View>
                ))}

                <Spacer height={Space.xl} />
                <ThemedButton variant="ghost" onPress={resetToTemplate} disabled={saving}>
                    <ThemedText variant="body">Reset to the template&apos;s targets</ThemedText>
                </ThemedButton>

                <FieldError>{error}</FieldError>

                <Spacer height={Space.xxl} />
                <ThemedButton onPress={handleSave} disabled={saving}>
                    <ThemedText variant="cardTitle" tone="onPrimary">
                        {saving ? 'Saving...' : 'Save targets'}
                    </ThemedText>
                </ThemedButton>
                <Spacer height={Space.xl} />
            </ScrollView>
        </ThemedView>
    )
}

export default ClientTargets

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SCREEN_PADDING,
    },
    scrollContent: {
        paddingBottom: Space.xl,
    },
    subtitle: {
        marginTop: Space.xs,
        marginBottom: 0,
    },
    note: {
        padding: Space.md,
    },

})
