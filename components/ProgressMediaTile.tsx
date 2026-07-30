import { Image, Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/Colors'
import { useDownloadURL } from '../hooks/useDownloadURL'

const ProgressMediaTile = ({ item, onPress }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const url = useDownloadURL(item.storagePath)

    return (
        <Pressable onPress={onPress} style={styles.tile}>
            {item.type === 'photo' && url ? (
                <Image source={{ uri: url }} style={styles.image} />
            ) : (
                <View style={[styles.placeholder, { backgroundColor: theme.uiBackground }]}>
                    <Ionicons name={item.type === 'video' ? 'videocam' : 'image'} size={28} color={theme.iconColor} />
                </View>
            )}
            {item.type === 'video' && (
                <View style={styles.playBadge}>
                    <Ionicons name="play" size={14} color="#fff" />
                </View>
            )}
        </Pressable>
    )
}

export default ProgressMediaTile

const styles = StyleSheet.create({
    tile: {
        width: '33.33%',
        aspectRatio: 1,
        padding: 2,
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
    },
    placeholder: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
