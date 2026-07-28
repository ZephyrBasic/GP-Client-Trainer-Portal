import { useEffect, useState } from 'react'
import { Image, ScrollView, StyleSheet, View, useColorScheme } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { deleteDoc, doc, onSnapshot } from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { useVideoPlayer, VideoView } from 'expo-video'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedButton from '../../../components/ThemedButton'
import CommentSection from '../../../components/CommentSection'
import Spacer from '../../../components/Spacer'
import { Colors } from '../../../constants/Colors'
import { db, storage } from '../../../firebase/config'
import { useAuth } from '../../../contexts/AuthContext'
import { useDownloadURL } from '../../../hooks/useDownloadURL'

const VideoPlayerView = ({ url }) => {
    const player = useVideoPlayer(url ?? null, (p) => {
        p.loop = false
    })

    if (!url) {
        return <View style={styles.media} />
    }
    return <VideoView player={player} style={styles.media} nativeControls allowsFullscreen />
}

const MediaDetail = () => {
    const { mediaId } = useLocalSearchParams()
    const { profile } = useAuth()
    const router = useRouter()
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const [media, setMedia] = useState(null)
    const [loading, setLoading] = useState(true)
    const [accessDenied, setAccessDenied] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const url = useDownloadURL(media?.storagePath)

    useEffect(() => {
        if (!mediaId) return
        const unsubscribe = onSnapshot(
            doc(db, 'progressMedia', mediaId),
            (snapshot) => {
                setMedia(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
                setLoading(false)
            },
            () => {
                setAccessDenied(true)
                setLoading(false)
            }
        )
        return unsubscribe
    }, [mediaId])

    const handleDelete = async () => {
        setDeleting(true)
        try {
            if (media?.storagePath) {
                await deleteObject(ref(storage, media.storagePath)).catch(() => {})
            }
            await deleteDoc(doc(db, 'progressMedia', mediaId))
            router.back()
        } catch (err) {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Loading...</ThemedText>
            </ThemedView>
        )
    }

    if (accessDenied || !media) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>This item isn't available.</ThemedText>
            </ThemedView>
        )
    }

    const isOwner = profile?.uid === media.clientId

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {media.type === 'video' ? (
                    <VideoPlayerView url={url} />
                ) : url ? (
                    <Image source={{ uri: url }} style={styles.media} />
                ) : (
                    <View style={[styles.media, { backgroundColor: theme.uiBackground }]} />
                )}

                {media.caption ? (
                    <>
                        <Spacer height={12} />
                        <ThemedText>{media.caption}</ThemedText>
                    </>
                ) : null}

                <Spacer height={20} />
                <CommentSection mediaId={mediaId} />

                {isOwner && (
                    <>
                        <Spacer height={24} />
                        {!confirmingDelete ? (
                            <ThemedButton
                                onPress={() => setConfirmingDelete(true)}
                                style={{ backgroundColor: Colors.warning }}
                            >
                                <ThemedText style={styles.deleteText}>Delete</ThemedText>
                            </ThemedButton>
                        ) : (
                            <View>
                                <ThemedText>Delete this item? This cannot be undone.</ThemedText>
                                <Spacer height={10} />
                                <View style={styles.confirmRow}>
                                    <ThemedButton
                                        onPress={() => setConfirmingDelete(false)}
                                        style={[styles.confirmBtn, { backgroundColor: theme.uiBackground }]}
                                        disabled={deleting}
                                    >
                                        <ThemedText>Cancel</ThemedText>
                                    </ThemedButton>
                                    <ThemedButton
                                        onPress={handleDelete}
                                        style={[styles.confirmBtn, { backgroundColor: Colors.warning }]}
                                        disabled={deleting}
                                    >
                                        <ThemedText style={styles.deleteText}>
                                            {deleting ? 'Deleting...' : 'Confirm Delete'}
                                        </ThemedText>
                                    </ThemedButton>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </ThemedView>
    )
}

export default MediaDetail

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    media: {
        width: '100%',
        height: 300,
        borderRadius: 8,
    },
    confirmRow: {
        flexDirection: 'row',
        gap: 10,
    },
    confirmBtn: {
        flex: 1,
    },
    deleteText: {
        color: '#fff',
        fontWeight: 'bold',
    },
})
