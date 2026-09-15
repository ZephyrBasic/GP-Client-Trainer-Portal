import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform, ScrollView, StyleSheet } from 'react-native'
import Constants from 'expo-constants'

import ExternalLink from './ExternalLink'
import Spacer from './Spacer'
import ThemedButton from './ThemedButton'
import ThemedCard from './ThemedCard'
import ThemedText from './ThemedText'
import ThemedView from './ThemedView'
import { Space } from '../constants/Layout'
import { reportError } from '../utils/crashReporting'
import { buildFeedbackMailto } from '../utils/links'

/**
 * The last thing between a render crash and a white page.
 *
 * React Native ships no error boundary of its own, and a boundary can only be a
 * class component - `componentDidCatch` has no hook equivalent, by design, so
 * this is the one class in the repo. It sits at the very root, outside
 * AuthProvider, so a throw inside the auth gate or the navigator is caught too;
 * that is also why the recovery screen below uses no context and no router -
 * everything it could ask has, by the time it renders, already failed.
 *
 * Recovery is a reset rather than a navigation. The routing convention here is
 * deliberately declarative (see app/_layout.tsx and hooks/useProtectedRoute): an
 * imperative `router.replace()` races the navigator, and would race it hardest
 * in exactly this state. Clearing the error re-mounts the tree from the top,
 * which is the real way back - and if whatever threw throws again immediately,
 * this screen returns, which is the honest outcome rather than a flicker.
 */

type Props = { children: ReactNode }
type State = { error: Error | null }

class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // The reason crash reporting needs this call at all: React *caught* this
        // error, so it never becomes an unhandled exception and Sentry's global
        // handlers never see it. Inert with no DSN configured, like everything
        // else in that module.
        reportError(error, { componentStack: info?.componentStack })
    }

    render() {
        const { error } = this.state
        if (!error) return this.props.children

        // Shown to the user, not just logged: a tester who can read the message
        // can quote it, and during a beta that is often the whole bug report.
        const message = error?.message ?? 'No message'

        return (
            <ThemedView style={styles.screen}>
                <ScrollView contentContainerStyle={styles.body}>
                    <ThemedText variant="title" tone="title">
                        Something went wrong
                    </ThemedText>
                    <Spacer height={Space.sm} />
                    <ThemedText variant="body" tone="body">
                        GreenPulse hit an error it couldn't recover from. Anything already saved is
                        safe. Try again, and tell us if it keeps happening.
                    </ThemedText>

                    <Spacer height={Space.xl} />
                    <ThemedCard muted={true}>
                        <ThemedText variant="label" tone="muted">
                            What broke
                        </ThemedText>
                        <Spacer height={Space.xs} />
                        <ThemedText variant="small" tone="muted">
                            {message}
                        </ThemedText>
                    </ThemedCard>

                    <Spacer height={Space.xl} />
                    <ThemedButton onPress={() => this.setState({ error: null })}>
                        <ThemedText variant="cardTitle" tone="onPrimary">
                            Try again
                        </ThemedText>
                    </ThemedButton>

                    <Spacer height={Space.lg} />
                    <ExternalLink
                        variant="meta"
                        label="Email us about this"
                        href={buildFeedbackMailto({
                            subject: 'GreenPulse crash',
                            note: `The app crashed with: ${message}`,
                            platform: Platform.OS,
                            version: Constants.expoConfig?.version,
                            // No role: the profile lives in a context that sits
                            // below this boundary, and may be the thing that
                            // threw.
                        })}
                    />
                </ScrollView>
            </ThemedView>
        )
    }
}

export default ErrorBoundary

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    body: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: Space.xl,
    },
})
