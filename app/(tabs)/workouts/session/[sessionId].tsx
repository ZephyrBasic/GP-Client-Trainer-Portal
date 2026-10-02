import { useLocalSearchParams, useNavigation } from 'expo-router'
import type { NavigationProp, ParamListBase } from '@react-navigation/native'

import LiveSession from '../../../../components/LiveSession'
import { useAuth } from '../../../../contexts/AuthContext'
import { useLeave } from '../../../../hooks/useLeave'

/**
 * A Client performing their own Session, pushed from Today. The screen itself is
 * components/LiveSession; this route decides only where it leads.
 */
const ClientLiveSession = () => {
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
    const { profile } = useAuth()
    // The Workouts tab's Stack, which this screen is pushed onto from Today.
    // Typed loosely: its route names are expo-router's file names, which the
    // typed-routes experiment types as hrefs, not as a param list.
    const navigation = useNavigation<NavigationProp<ParamListBase>>()

    // Leaving without finishing always lands on Today, and takes this route
    // out of the Workouts Stack on the way (hooks/useLeave). A plain back()
    // did neither: Today pushes this screen into another tab's Stack, so back()
    // only switched tabs and left the route sitting there - and the next
    // Session started was pushed on top of it, so its back button popped into
    // the old one, by then usually discarded. Nothing is lost by leaving: the
    // draft already holds every tick, and Today offers the Session back.
    const { leave } = useLeave({ home: '/', homeLabel: 'Today', toToday: true })

    // The summary, sat on History alone. Replacing this screen with it left
    // the summary as the only route in the Stack - no back arrow, so the
    // nearest thing to a way out was "Create template" or "Delete". This way
    // it gets the ordinary back arrow, to /workouts, and nothing leads back
    // into a live screen for a Session that is over.
    const openSummary = () =>
        navigation.reset({
            index: 1,
            routes: [{ name: 'index' }, { name: '[id]', params: { id: sessionId } }],
        })

    return (
        <LiveSession
            sessionId={sessionId}
            leave={leave}
            leaveLabel="Back to Today"
            openSummary={openSummary}
            finishedHref="/workouts"
            templateAuthorId={profile?.uid}
        />
    )
}

export default ClientLiveSession
