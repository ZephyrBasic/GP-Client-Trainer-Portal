import { FlatList, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import ThemedView from '../../../../components/ThemedView'
import ThemedText from '../../../../components/ThemedText'
import ProgressMediaTile from '../../../../components/ProgressMediaTile'
import { useProgressMedia } from '../../../../hooks/useProgressMedia'

const ClientProgress = () => {
    const { clientId } = useLocalSearchParams()
    const router = useRouter()
    const { media, loading } = useProgressMedia(clientId)

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={media}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !loading ? (
                        <ThemedText style={styles.empty}>This client hasn't uploaded any progress photos or videos yet.</ThemedText>
                    ) : null
                }
                renderItem={({ item }) => (
                    <ProgressMediaTile item={item} onPress={() => router.push(`/progress/${item.id}`)} />
                )}
            />
        </ThemedView>
    )
}

export default ClientProgress

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 12,
    },
    listContent: {
        paddingBottom: 20,
    },
    empty: {
        marginTop: 10,
        paddingHorizontal: 8,
    },
})
