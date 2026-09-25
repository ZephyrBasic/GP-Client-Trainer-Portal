import { Tabs, useGlobalSearchParams, useSegments } from 'expo-router'
import { useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FontFamily } from '../../constants/Type'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/Colors'
import { useAuth } from '../../contexts/AuthContext'
import { isFromToday } from '../../hooks/useLeave'

const TabsLayout = () => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const { profile } = useAuth()
    const isTrainer = profile?.role === 'trainer'
    const segments = useSegments()
    const insets = useSafeAreaInsets()

    // The live session draws its own footer (a running clock, FINISH), so the
    // tab bar underneath it is dead weight at best and a second way to leave a
    // half-finished workout at worst. Detected from the route rather than a
    // screen-owned flag, since a flag would need plumbing through a navigator
    // that does not otherwise know what its screens are doing.
    const inLiveSession = segments[1] === 'workouts' && segments[2] === 'session'
    // The same goes for anything else Today opens in the Workouts tab - logging
    // a past workout, writing or editing their own. Its back goes to Today
    // (hooks/useLeave), and a tab bar lighting up History underneath says the
    // Client is somewhere they are not.
    const onTodayDetour = isFromToday(useGlobalSearchParams())

    // Tabs whose route is a folder render their own Stack header (with the back
    // button and per-screen title), so the Tabs header is switched off for those
    // four - otherwise the title shows up twice, stacked.
    return (
        <Tabs
            screenOptions={{
                // Me is the one tab with a native header; it matches the
                // Stacks' (hooks/useHeaderOptions).
                headerStyle: { backgroundColor: theme.navBackground },
                headerTintColor: theme.title,
                headerShadowVisible: false,
                headerTitleAlign: 'left',
                headerTitleStyle: { fontFamily: FontFamily.heading, fontSize: 20, color: theme.title },
                // The theme's own hairline: React Navigation's default border
                // is a light grey that glared on the dark theme. The height is
                // explicit because the default was 4px short of its items on
                // the web, clipping every label and scrolling the page.
                tabBarStyle: inLiveSession || onTodayDetour
                    ? { display: 'none' }
                    : {
                          backgroundColor: theme.navBackground,
                          borderTopColor: theme.line,
                          height: 60 + insets.bottom,
                          paddingTop: 6,
                          paddingBottom: insets.bottom + 6,
                      },
                // The items' own default padding made each 52px in a 47px bar.
                tabBarItemStyle: { paddingVertical: 0, height: 48 },
                tabBarActiveTintColor: theme.iconColorFocused,
                tabBarInactiveTintColor: theme.iconColor,
            }}
        >
            {/* Today draws its own header - eyebrow date, title and the
                trainer pill - so the native one is switched off here too,
                same as every folder-route tab below it. */}
            <Tabs.Screen
                name="index"
                options={{
                    headerShown: false,
                    title: 'Today',
                    href: isTrainer ? null : undefined,
                    tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
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
            {/* Both roles now, where this was client-only: a Trainer had nowhere
                to author a Workout Template. The two roles see different things
                under it - a Client's own session History, a Trainer's Template
                Library - so the label, icon and landing route all switch on
                role here rather than the screen redirecting one of them away. */}
            <Tabs.Screen
                name="workouts"
                options={{
                    headerShown: false,
                    title: isTrainer ? 'Library' : 'History',
                    href: isTrainer ? '/workouts/templates' : '/workouts',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name={isTrainer ? 'barbell' : 'list'} size={size} color={color} />
                    ),
                }}
            />
            {/* Messaging is out of scope while the core tracking loop is built (see
                CLAUDE.md, "Current scope"); it showed for both roles before, so
                dropping `href: null` switches the tab back on. Also add a Trainer
                line to `deletionNotes` in utils/deleteAccount.ts: messages can't be
                deleted, and today only the Client's notes say so. */}
            <Tabs.Screen
                name="messages"
                options={{
                    headerShown: false,
                    title: 'Messages',
                    href: null,
                    tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
                }}
            />
            {/* Progress media, likewise out of scope - but this one was a client-only
                tab, so switching it back on means restoring the role check
                (`href: isTrainer ? null : undefined`), not plain `undefined`. And a
                trainer's comments on media outlive the Client's account deletion, so
                `deletionNotes` in utils/deleteAccount.ts needs a line saying so. */}
            <Tabs.Screen
                name="progress"
                options={{
                    headerShown: false,
                    title: 'Progress',
                    href: null,
                    tabBarIcon: ({ color, size }) => <Ionicons name="videocam" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Me',
                    tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
                }}
            />
        </Tabs>
    )
}

export default TabsLayout
