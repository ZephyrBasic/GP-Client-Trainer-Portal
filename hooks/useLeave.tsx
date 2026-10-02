import { useCallback, useLayoutEffect } from 'react'
import { BackHandler } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router'
import BackPill from '../components/BackPill'
import type { NavigationProp, ParamListBase } from '@react-navigation/native'

type Nav = NavigationProp<ParamListBase>

// The query param Today adds to anything it opens in another tab. A URL
// segment rather than navigator state, because it has to survive a web
// refresh - the screen is still a detour from Today afterwards.
export const FROM_TODAY = 'today'

// Whether a route opened with these params is a detour from Today. Exported
// for the navigators, which decide transitions and the tab bar from the route
// alone, before the screen has rendered.
export const isFromToday = (params: unknown) => (params as { from?: string } | undefined)?.from === FROM_TODAY

// Whether there is a screen under this one to go back to *within its tab*.
// navigation.canGoBack() will not do: it also counts the tab navigator's own
// history, which is exactly how a back() from a screen pushed in from Today
// ended up switching tabs and leaving the screen stranded in the Workouts
// Stack. Walks up through nested Stacks (clients/[clientId] has one of its own)
// and stops at the tabs.
const hasScreenBelow = (navigation: Nav) => {
    let nav: Nav | undefined = navigation
    while (nav) {
        const state = nav.getState()
        if (state.type === 'tab') return false
        if (state.type === 'stack' && state.index > 0) return true
        nav = nav.getParent()
    }
    return false
}

type Options = {
    /** Where back goes when nothing is under this screen - a direct URL, a refresh. */
    home: Href
    /** What the header's back button calls `home`. */
    homeLabel: string
    /** Always leave to Today, whatever the params say - the live Session. */
    toToday?: boolean
    /**
     * Called with `leave` instead of leaving, by the back controls this hook
     * draws, so a screen with unsaved work can ask first. Needed because
     * `beforeRemove` can't see the detour back to Today: that switches tabs
     * before the reset removes this route, so refusing the reset would strand
     * the screen behind Today rather than keep it on screen.
     */
    guard?: (leave: () => void) => void
}

/**
 * Where "back" goes from a screen, decided once, so every back button, the
 * header's and Android's alike, agrees:
 *
 *   opened from Today   Today, and this route comes out of the Stack it was
 *                       pushed into - otherwise it waits there, stale, for
 *                       the next time that tab is opened
 *   a screen below      that screen, as usual
 *   nothing below       this Stack's home, so no screen is ever a dead end
 *
 * In the first and last case the header's own arrow would be wrong or
 * missing, so this draws one - React Navigation's own button, so it looks the
 * same as every other back arrow in the app - and takes Android's back button
 * too. Screens that draw their own header call `leave` from their own button.
 */
export const useLeave = ({ home, homeLabel, toToday, guard }: Options) => {
    const router = useRouter()
    const navigation = useNavigation<Nav>()
    const params = useLocalSearchParams()
    const fromToday = toToday || isFromToday(params)
    const ownBack = fromToday || !hasScreenBelow(navigation)

    const leave = useCallback(() => {
        if (fromToday) {
            router.navigate('/')
            const state = navigation.getState()
            const current = state.routes[state.index]?.key
            const kept = state.routes
                .filter((route) => route.key !== current)
                .map(({ key, name, params }) => ({ key, name, params }))
            navigation.reset({
                index: Math.max(kept.length - 1, 0),
                routes: kept.length ? kept : [{ name: 'index' }],
            })
            return
        }
        if (hasScreenBelow(navigation)) {
            router.back()
            return
        }
        router.replace(home)
    }, [fromToday, home, navigation, router])

    const label = fromToday ? 'Today' : homeLabel
    const back = useCallback(() => (guard ? guard(leave) : leave()), [guard, leave])

    useLayoutEffect(() => {
        if (!ownBack) return
        navigation.setOptions({
            headerLeft: () => <BackPill onPress={back} label={`Back to ${label}`} style={{ marginLeft: -8 }} />,
        })
    }, [ownBack, label, back, navigation])

    // Focus-gated, since a screen left mounted in another tab would otherwise
    // answer the back button for whatever is on screen now.
    useFocusEffect(
        useCallback(() => {
            if (!ownBack) return
            const sub = BackHandler.addEventListener('hardwareBackPress', () => {
                back()
                return true
            })
            return () => sub.remove()
        }, [ownBack, back])
    )

    return { leave, fromToday }
}
