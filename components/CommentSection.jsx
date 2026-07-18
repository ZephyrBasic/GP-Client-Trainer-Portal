import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import ThemedButton from './ThemedButton'
import Spacer from './Spacer'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { useComments } from '../hooks/useComments'
import { useUserNames } from '../hooks/useUserNames'

const CommentSection = ({ mediaId }) => {
    const { profile } = useAuth()
    const { comments, loading } = useComments(mediaId)
    const names = useUserNames(comments.map((comment) => comment.authorId))
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)

    const handleSend = async () => {
        const trimmed = text.trim()
        if (!trimmed || sending) return

        setSending(true)
        setText('')
        try {
            await addDoc(collection(db, 'progressMedia', mediaId, 'comments'), {
                authorId: profile.uid,
                text: trimmed,
                createdAt: serverTimestamp(),
            })
        } catch (err) {
            setText(trimmed)
        } finally {
            setSending(false)
        }
    }

    return (
        <View>
            <ThemedText style={styles.heading}>Comments</ThemedText>
            <Spacer height={8} />

            {!loading && comments.length === 0 ? <ThemedText style={styles.empty}>No comments yet.</ThemedText> : null}

            {comments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                    <ThemedText style={styles.author}>{names[comment.authorId] ?? '...'}</ThemedText>
                    <ThemedText>{comment.text}</ThemedText>
                </View>
            ))}

            <Spacer height={12} />
            <View style={styles.inputRow}>
                <ThemedTextInput
                    style={styles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="Add a comment"
                />
                <ThemedButton
                    onPress={handleSend}
                    disabled={!text.trim() || sending}
                    style={styles.sendBtn}
                >
                    <ThemedText style={styles.sendText}>Post</ThemedText>
                </ThemedButton>
            </View>
        </View>
    )
}

export default CommentSection

const styles = StyleSheet.create({
    heading: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    empty: {
        opacity: 0.7,
    },
    commentRow: {
        marginBottom: 8,
    },
    author: {
        fontWeight: 'bold',
        fontSize: 12,
        opacity: 0.8,
        marginBottom: 2,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    input: {
        flex: 1,
    },
    sendBtn: {
        width: 90,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    sendText: {
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
    },
})
