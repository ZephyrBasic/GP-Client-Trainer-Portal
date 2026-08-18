import { useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native'
import { collection, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'

import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import ChatBubble from './ChatBubble'
import OfflineBanner from './OfflineBanner'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { useMessages } from '../hooks/useMessages'
import { SNAPSHOT_TIMEOUT_MS } from '../hooks/useFirestoreSnapshot'
import { useOffline } from '../hooks/useOffline'
import { Colors } from '../constants/Colors'

const ChatThread = ({ chatId, clientId, trainerId }) => {
    const { profile } = useAuth()
    const [chatReady, setChatReady] = useState(false)
    const [chatSetupFailed, setChatSetupFailed] = useState(false)
    const [chatAttempt, setChatAttempt] = useState(0)
    const { messages, loading, offline: messagesOffline, retry } = useMessages(chatReady ? chatId : null)
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')
    const listRef = useRef(null)

    useEffect(() => {
        // The messages subcollection's read/create rules get() this parent
        // doc, so it must exist *before* we subscribe to messages - otherwise
        // the listener can attach first and die permanently on a
        // permission-denied (Firestore doesn't auto-retry a denied listener).
        setChatReady(false)
        setChatSetupFailed(false)

        // This gate needs its own timeout for the same reason the listeners do,
        // and it is easy to miss because it isn't an onSnapshot. Offline, setDoc's
        // promise never settles - it resolves on the server's acknowledgement,
        // which never comes - so chatReady stayed false, useMessages was never
        // given a chatId, and the thread rendered a confident "No messages yet.
        // Say hello!" over a conversation it simply hadn't loaded.
        const timer = setTimeout(() => setChatSetupFailed(true), SNAPSHOT_TIMEOUT_MS)

        setDoc(doc(db, 'chats', chatId), { clientId, trainerId }, { merge: true })
            .then(() => {
                clearTimeout(timer)
                setChatSetupFailed(false)
                setChatReady(true)
            })
            .catch((err) => {
                clearTimeout(timer)
                console.warn('[chat] could not prepare chat doc:', err)
                setChatSetupFailed(true)
            })

        return () => clearTimeout(timer)
    }, [chatId, clientId, trainerId, chatAttempt])

    const offline = useOffline(messagesOffline, chatSetupFailed)

    // Retry has to re-run the setDoc gate as well as the listener: if chat setup
    // is what failed, resubscribing alone would have nothing to subscribe to.
    const handleRetry = () => {
        setChatAttempt((n) => n + 1)
        retry()
    }

    useEffect(() => {
        if (messages.length > 0) {
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
        }
    }, [messages.length])

    const handleSend = async () => {
        const trimmed = text.trim()
        if (!trimmed || sending) return

        setSending(true)
        setError('')
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
            setError('Message failed to send. Please try again.')
        } finally {
            setSending(false)
        }
    }

    const canSend = text.trim().length > 0 && !sending

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Outside the list, not a ListHeaderComponent: the thread scrolls
                itself to the newest message, which would park a header banner
                off-screen exactly when it matters. */}
            <OfflineBanner visible={offline} onRetry={handleRetry} style={styles.banner} />
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={
                    loading ? (
                        <ThemedText style={styles.empty}>Loading...</ThemedText>
                    ) : (
                        <ThemedText style={styles.empty}>No messages yet. Say hello!</ThemedText>
                    )
                }
                renderItem={({ item }) => <ChatBubble text={item.text} isOwn={item.senderId === profile.uid} />}
            />
            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
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
    banner: {
        marginHorizontal: 16,
        marginTop: 12,
    },
    empty: {
        textAlign: 'center',
        marginTop: 20,
        opacity: 0.7,
    },
    error: {
        color: Colors.warning,
        paddingHorizontal: 16,
        paddingBottom: 4,
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
