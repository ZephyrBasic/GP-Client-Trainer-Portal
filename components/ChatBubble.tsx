import { StyleSheet, View, useColorScheme } from 'react-native'
import ThemedText from './ThemedText'
import { Colors } from '../constants/Colors'

const ChatBubble = ({ text, isOwn }) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
            <View style={[styles.bubble, { backgroundColor: isOwn ? Colors.primary : theme.uiBackground }]}>
                <ThemedText style={isOwn ? styles.textOwn : null}>{text}</ThemedText>
            </View>
        </View>
    )
}

export default ChatBubble

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    rowOwn: {
        justifyContent: 'flex-end',
    },
    rowOther: {
        justifyContent: 'flex-start',
    },
    bubble: {
        maxWidth: '75%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
    },
    textOwn: {
        color: '#fff',
    },
})
