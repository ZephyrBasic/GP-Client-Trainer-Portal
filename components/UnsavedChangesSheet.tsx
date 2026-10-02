import { StyleSheet } from 'react-native'
import Pressable from './Touchable'

import BottomSheet from './BottomSheet'
import Spacer from './Spacer'
import ThemedButton from './ThemedButton'
import ThemedText from './ThemedText'
import { Space } from '../constants/Layout'

type Props = {
    visible: boolean
    /** Keep editing: the sheet closes and the screen stays. */
    onClose: () => void
    onSave: () => void
    onDiscard: () => void
}

/**
 * Asked when leaving a Workout Template with edits not yet saved.
 *
 * A sheet rather than hooks/useConfirmLeave's Alert, because this question has
 * three answers and the web's window.confirm can only offer two - and Save is
 * the one that matters, since the edits are usually wanted.
 */
const UnsavedChangesSheet = ({ visible, onClose, onSave, onDiscard }: Props) => (
    <BottomSheet visible={visible} onClose={onClose}>
        <ThemedText variant="heading" tone="title">
            Save your changes?
        </ThemedText>
        <Spacer height={Space.sm} />
        <ThemedText variant="body" tone="body">
            You&apos;ve changed this template since it was last saved.
        </ThemedText>

        <Spacer height={Space.lg} />
        <ThemedButton onPress={onSave}>
            <ThemedText variant="cardTitle" tone="onPrimary">
                Save changes
            </ThemedText>
        </ThemedButton>
        <Spacer height={Space.sm} />
        <ThemedButton variant="danger" onPress={onDiscard}>
            <ThemedText variant="cardTitle" tone="danger">
                Discard changes
            </ThemedText>
        </ThemedButton>
        <Pressable onPress={onClose} style={styles.cancel}>
            <ThemedText variant="body" tone="muted">
                Keep editing
            </ThemedText>
        </Pressable>
    </BottomSheet>
)

export default UnsavedChangesSheet

const styles = StyleSheet.create({
    cancel: {
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Space.lg,
    },
})
