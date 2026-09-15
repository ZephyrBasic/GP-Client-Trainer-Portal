import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Spacer from './Spacer'
import ThemedButton from './ThemedButton'
import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { getAuthErrorMessage } from '../utils/firebaseErrors'
import { deletionNotes, deletionTakes, trainerDeletionBlock } from '../utils/deleteAccount'

type Props = {
    visible: boolean
    onClose: () => void
    /** 'trainer' | 'client' - decides what the lists below say. */
    role: string
    /** How many Clients this Trainer still has; 0 for a Client; null while unknown. */
    clientCount: number | null
    /** Runs the delete. Rejects with a Firebase error, which is shown as English. */
    onConfirm: (password: string) => Promise<void>
}

/**
 * The confirm step for deleting an account, and the honest account of what that
 * does.
 *
 * A sheet rather than a route, because Profile is a leaf file in the tabs
 * navigator and turning it into a folder to hold one destructive screen would
 * rearrange the tab config for the sake of a confirm dialog. Same plain RN Modal
 * as SomethingElseSheet, for the same reason it gives.
 *
 * Three things it deliberately does rather than the usual one-tap confirm:
 * lists what goes, lists what stays (utils/deleteAccount explains why the second
 * list is not empty and cannot be), and asks for the password. The password is
 * the re-authentication Firebase requires before deleting an account anyway, so
 * making it the confirmation gesture costs nothing and turns an irreversible tap
 * into a deliberate act.
 */
const DeleteAccountSheet = ({ visible, onClose, role, clientCount, onConfirm }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const insets = useSafeAreaInsets()

    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const blocked = trainerDeletionBlock(role, clientCount)

    const close = () => {
        // Nothing typed survives the sheet closing. A password left in state
        // would be re-shown the next time it opens, which is both a surprise and
        // one more place the value sits around.
        setPassword('')
        setError('')
        onClose()
    }

    const handleConfirm = async () => {
        setError('')
        if (!password) {
            setError('Please enter your password to confirm.')
            return
        }

        setSubmitting(true)
        try {
            await onConfirm(password)
            // No success state and no close(): deleting the auth account signs
            // this device out, and the route guard in app/_layout.tsx replaces
            // the whole tree with the login screen. A "done" message would be
            // rendering into a screen that is already gone.
        } catch (err) {
            setError(getAuthErrorMessage(err))
            setSubmitting(false)
        }
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
            <Pressable style={styles.backdrop} onPress={close}>
                {/* Swallows the backdrop's onPress so tapping the sheet itself
                    doesn't also close through it a frame later. */}
                <Pressable
                    style={[
                        styles.sheet,
                        { backgroundColor: theme.navBackground, paddingBottom: insets.bottom + Space.lg },
                    ]}
                    onPress={() => {}}
                >
                    <View style={[styles.grabber, { backgroundColor: theme.line }]} />
                    <ScrollView contentContainerStyle={styles.body}>
                        <ThemedText variant="heading" tone="title">
                            Delete your account
                        </ThemedText>

                        {blocked ? (
                            <>
                                <Spacer height={Space.md} />
                                <ThemedText variant="body" tone="body">
                                    {blocked}
                                </ThemedText>
                            </>
                        ) : (
                            <>
                                <Spacer height={Space.md} />
                                <ThemedText variant="body" tone="body">
                                    This cannot be undone. Deleting removes:
                                </ThemedText>
                                <Spacer height={Space.sm} />
                                {deletionTakes(role).map((line) => (
                                    <ThemedText key={line} variant="body" tone="body" style={styles.bullet}>
                                        {`•  ${line}`}
                                    </ThemedText>
                                ))}

                                <Spacer height={Space.lg} />
                                <ThemedText variant="label" tone="muted">
                                    What stays behind
                                </ThemedText>
                                <Spacer height={Space.xs} />
                                {deletionNotes(role).map((line) => (
                                    <ThemedText key={line} variant="small" tone="muted" style={styles.bullet}>
                                        {line}
                                    </ThemedText>
                                ))}

                                <Spacer height={Space.lg} />
                                <ThemedText variant="label" tone="muted">
                                    Confirm with your password
                                </ThemedText>
                                <Spacer height={Space.sm} />
                                <ThemedTextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    editable={!submitting}
                                />
                            </>
                        )}

                        {error ? (
                            <>
                                <Spacer height={Space.md} />
                                <ThemedText variant="body" tone="danger">
                                    {error}
                                </ThemedText>
                            </>
                        ) : null}

                        <Spacer height={Space.lg} />
                        {blocked ? null : (
                            <>
                                <ThemedButton variant="danger" onPress={handleConfirm} disabled={submitting}>
                                    <ThemedText variant="cardTitle" tone="danger">
                                        {submitting ? 'Deleting...' : 'Delete my account'}
                                    </ThemedText>
                                </ThemedButton>
                                <Spacer height={Space.sm} />
                            </>
                        )}
                        <Pressable onPress={close} style={styles.cancel} disabled={submitting}>
                            <ThemedText variant="body" tone="muted">
                                {blocked ? 'Close' : 'Cancel'}
                            </ThemedText>
                        </Pressable>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    )
}

export default DeleteAccountSheet

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: Radius.hero,
        borderTopRightRadius: Radius.hero,
        paddingTop: Space.sm,
        paddingHorizontal: Space.xl,
        // There is a lot to read here, and none of it should push the confirm
        // button off a small screen - so the sheet is capped and its contents
        // scroll rather than the sheet growing to fill the display.
        maxHeight: '88%',
    },
    grabber: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: Radius.rail,
        marginBottom: Space.md,
    },
    body: {
        paddingBottom: Space.md,
    },
    bullet: {
        marginBottom: Space.xs,
    },
    cancel: {
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
})
