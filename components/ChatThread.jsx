import { useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native'
import { collection, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'

import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import ChatBubble from './ChatBubble'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { useMessages } from '../hooks/useMessages'
import { Colors } from '../constants/Colors'

const ChatThread = ({ chatId, clientId, trainerId }) => {
    const { profile } = useAuth()
    const [chatReady, setChatReady] = useState(false)
    const { messages, loading } = useMessages(chatReady ? chatId : null)
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const listRef = useRef(null)

    useEffect(() => {
        // The messages subcollection's read/create rules get() this parent
        // doc, so it must exist *before* we subscribe to messages - otherwise
        // the listener can attach first and die permanently on a
        // permission-denied (Firestore doesn't auto-retry a denied listener).
        setChatReady(false)
        setDoc(doc(db, 'chats', chatId), { clientId, trainerId }, { merge: true })
            .then(() => setChatReady(true))
            .catch(() => {})
    }, [chatId, clientId, trainerId])

    useEffect(() => {
        if (messages.length > 0) {
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
        }
    }, [messages.length])

    const handleSend = async () => {
        const trimmed = text.trim()
        if (!trimmed || sending) return

        setSending(true)
        setText('')
        try {
            const batch = writeBatch(db)
            const messageRef = doc(collection(db, 'chats', chatId, 'messages'))
            batch.set(messageRef, { senderId: profile.uid, text: trimmed, createdAt: serverTimestamp() })
            batch.set(
                doc(db, 'chats', chatId),
                { clientId, trainerId, lastMessage: trimmed, lastMessageAt: serverTimestamp() },
                { merge: true }
            )
            await batch.commit()
        } catch (err) {
            setText(trimmed)
        } finally {
            setSending(false)
        }
    }

    const canSend = text.trim().length > 0 && !sending

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={
                    !loading ? <ThemedText style={styles.empty}>No messages yet. Say hello!</ThemedText> : null
                }
                renderItem={({ item }) => <ChatBubble text={item.text} isOwn={item.senderId === profile.uid} />}
            />
            <View style={styles.inputRow}>
                <ThemedTextInput
                    style={styles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="Type a message"
                    multiline
                />
                <Pressable
                    onPress={handleSend}
                    disabled={!canSend}
                    style={({ pressed }) => [
                        styles.sendBtn,
                        !canSend && styles.sendBtnDisabled,
                        pressed && canSend && styles.sendBtnPressed,
                    ]}
                >
                    <ThemedText style={styles.sendBtnText}>Send</ThemedText>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    )
}

export default ChatThread

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    empty: {
        textAlign: 'center',
        marginTop: 20,
        opacity: 0.7,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        gap: 8,
    },
    input: {
        flex: 1,
        maxHeight: 100,
    },
    sendBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 5,
    },
    sendBtnDisabled: {
        opacity: 0.5,
    },
    sendBtnPressed: {
        opacity: 0.8,
    },
    sendBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
