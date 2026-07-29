import { Tabs } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/Colors'
import { useAuth } from '../../contexts/AuthContext'

const TabsLayout = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { profile } = useAuth()
    const isTrainer = profile?.role === 'trainer'

    // Tabs whose route is a folder render their own Stack header (with the back
    // button and per-screen title), so the Tabs header is switched off for those
    // four - otherwise the title shows up twice, stacked.
    return (
        <Tabs
            screenOptions={{
                headerStyle: { backgroundColor: theme.navBackground },
                headerTintColor: theme.title,
                tabBarStyle: { backgroundColor: theme.navBackground },
                tabBarActiveTintColor: theme.iconColorFocused,
                tabBarInactiveTintColor: theme.iconColor,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    href: isTrainer ? null : undefined,
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="clients"
                options={{
                    headerShown: false,
                    title: 'Clients',
                    href: isTrainer ? undefined : null,
                    tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="workouts"
                options={{
                    headerShown: false,
                    title: 'Workouts',
                    href: isTrainer ? null : undefined,
                    tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="messages"
                options={{
                    headerShown: false,
                    title: 'Messages',
                    tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="progress"
                options={{
                    headerShown: false,
                    title: 'Progress',
                    href: isTrainer ? null : undefined,
                    tabBarIcon: ({ color, size }) => <Ionicons name="videocam" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
                }}
            />
        </Tabs>
    )
}

export default TabsLayout
