import { useState } from 'react'
import { FlatList, Image, Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'

import ThemedView from '../../../components/ThemedView'
import ThemedText from '../../../components/ThemedText'
import ThemedTextInput from '../../../components/ThemedTextInput'
import ThemedButton from '../../../components/ThemedButton'
import ProgressMediaTile from '../../../components/ProgressMediaTile'
import Spacer from '../../../components/Spacer'
import { Colors } from '../../../constants/Colors'
import { useAuth } from '../../../contexts/AuthContext'
import { useProgressMedia } from '../../../hooks/useProgressMedia'
import { uploadProgressMedia } from '../../../utils/uploadProgressMedia'

const ProgressFeed = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { profile } = useAuth()
    const router = useRouter()
    const { media, loading } = useProgressMedia(profile?.uid)

    const [pendingAsset, setPendingAsset] = useState(null)
    const [caption, setCaption] = useState('')
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState('')

    const pickFrom = async (launcher) => {
        setError('')
        const permission = await launcher.requestPermission()
        if (!permission.granted) {
            setError(launcher.deniedMessage)
            return
        }
        const result = await launcher.launch({
            mediaTypes: ['images', 'videos'],
            quality: 0.7,
            videoMaxDuration: 60,
        })
        if (!result.canceled && result.assets?.[0]) {
            setPendingAsset(result.assets[0])
            setCaption('')
        }
    }

    const pickFromLibrary = () =>
        pickFrom({
            requestPermission: ImagePicker.requestMediaLibraryPermissionsAsync,
            launch: ImagePicker.launchImageLibraryAsync,
            deniedMessage: 'Photo library permission is required.',
        })

    const captureNew = () =>
        pickFrom({
            requestPermission: ImagePicker.requestCameraPermissionsAsync,
            launch: ImagePicker.launchCameraAsync,
            deniedMessage: 'Camera permission is required.',
        })

    const handleUpload = async () => {
        if (!pendingAsset) return
        setError('')
        setUploading(true)
        setProgress(0)
        try {
            await uploadProgressMedia({
                uri: pendingAsset.uri,
                type: pendingAsset.type === 'video' ? 'video' : 'photo',
                clientId: profile.uid,
                caption,
                onProgress: setProgress,
            })
            setPendingAsset(null)
            setCaption('')
        } catch (err) {
            setError(err.message || 'Upload failed. Please try again.')
        } finally {
            setUploading(false)
        }
    }

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={media}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <View style={styles.uploadSection}>
                        {!pendingAsset ? (
                            <View style={styles.pickerRow}>
                                <ThemedButton onPress={captureNew} style={styles.pickerBtn}>
                                    <ThemedText style={styles.pickerBtnText}>Record / Take Photo</ThemedText>
                                </ThemedButton>
                                <ThemedButton onPress={pickFromLibrary} style={styles.pickerBtn}>
                                    <ThemedText style={styles.pickerBtnText}>Choose from Library</ThemedText>
                                </ThemedButton>
                            </View>
                        ) : (
                            <View>
                                {pendingAsset.type === 'video' ? (
                                    <View style={[styles.preview, { backgroundColor: theme.uiBackground }]}>
                                        <ThemedText>Video selected</ThemedText>
                                    </View>
                                ) : (
                                    <Image source={{ uri: pendingAsset.uri }} style={styles.preview} />
                                )}
                                <Spacer height={10} />
                                <ThemedTextInput
                                    value={caption}
                                    onChangeText={setCaption}
                                    placeholder="Add a caption (optional)"
                                    editable={!uploading}
                                />
                                <Spacer height={10} />
                                {uploading ? (
                                    <View style={styles.progressTrack}>
                                        <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
                                    </View>
                                ) : (
                                    <View style={styles.confirmRow}>
                                        <ThemedButton
                                            onPress={() => setPendingAsset(null)}
                                            style={[styles.confirmBtn, { backgroundColor: theme.uiBackground }]}
                                        >
                                            <ThemedText>Cancel</ThemedText>
                                        </ThemedButton>
                                        <ThemedButton onPress={handleUpload} style={styles.confirmBtn}>
                                            <ThemedText style={styles.pickerBtnText}>Upload</ThemedText>
                                        </ThemedButton>
                                    </View>
                                )}
                            </View>
                        )}
                        {error ? (
                            <>
                                <Spacer height={10} />
                                <ThemedText style={{ color: Colors.warning }}>{error}</ThemedText>
                            </>
                        ) : null}
                        <Spacer height={10} />
                    </View>
                }
                ListEmptyComponent={
                    loading ? (
                        <ThemedText style={styles.empty}>Loading...</ThemedText>
                    ) : (
                        <ThemedText style={styles.empty}>
                            No progress photos or videos yet. Add your first one above.
                        </ThemedText>
                    )
                }
                renderItem={({ item }) => (
                    <ProgressMediaTile item={item} onPress={() => router.push(`/progress/${item.id}`)} />
                )}
            />
        </ThemedView>
    )
}

export default ProgressFeed

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 12,
    },
    listContent: {
        paddingBottom: 20,
    },
    uploadSection: {
        paddingHorizontal: 8,
        marginBottom: 10,
    },
    pickerRow: {
        flexDirection: 'row',
        gap: 10,
    },
    pickerBtn: {
        flex: 1,
    },
    pickerBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    preview: {
        width: '100%',
        height: 180,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmRow: {
        flexDirection: 'row',
        gap: 10,
    },
    confirmBtn: {
        flex: 1,
    },
    progressTrack: {
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(128,128,128,0.25)',
        overflow: 'hidden',
    },
    progressBar: {
        height: 10,
        backgroundColor: Colors.primary,
    },
    empty: {
        marginTop: 10,
        paddingHorizontal: 8,
    },
})
