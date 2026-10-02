import { useLocalSearchParams, useNavigation } from 'expo-router'
import type { NavigationProp, ParamListBase } from '@react-navigation/native'

import LiveSession from '../../../../../components/LiveSession'
import { useAuth } from '../../../../../contexts/AuthContext'
import { useLeave } from '../../../../../hooks/useLeave'

/**
 * A Trainer running a Session for their Client - the beta's demo, done on the
 * Trainer's phone. The same screen the Client sees (components/LiveSession),
 * writing the same Session into the Client's history; only the way in and out
 * belongs to the Trainer, so it lives on the Client's page rather than in a
 * Client's Today.
 */
const TrainerLiveSession = () => {
    const { clientId, sessionId } = useLocalSearchParams<{ clientId: string; sessionId: string }>()
    const { profile } = useAuth()
    // The Client's own Stack (clients/[clientId]/_layout). Typed loosely for
    // the same reason as the Client's live route.
    const navigation = useNavigation<NavigationProp<ParamListBase>>()

    // Pushed from the Client's page, so back is simply that page.
    const { leave } = useLeave({ home: `/clients/${clientId}`, homeLabel: 'Client' })

    // The Trainer's own summary of the Session, with the Client's page under it.
    const openSummary = () =>
        navigation.reset({
            index: 1,
            routes: [{ name: 'index' }, { name: 'session/[id]', params: { id: sessionId } }],
        })

    return (
        <LiveSession
            sessionId={sessionId}
            leave={leave}
            leaveLabel="Back to client"
            openSummary={openSummary}
            finishedHref={`/clients/${clientId}`}
            templateAuthorId={profile?.uid}
            trainerLed
        />
    )
}

export default TrainerLiveSession
