import { useState } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'

import ThemedText from './ThemedText'
import ThemedButton, { buttonTextColor } from './ThemedButton'
import SectionLabel from './SectionLabel'
import Spacer from './Spacer'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'
import { elapsedSecondsBetween, formatAgo } from '../utils/elapsed'

type Props = {
    /** The Session left open, or null when there is none. */
    session: any
    onResume: () => void
    onDiscard: () => void
    discarding?: boolean
}

// Past this, "in progress" stops being a plausible description of a workout and
// starts being a phone that was put in a pocket. One hour, because that is about
// the length of a training session: below it the Client is probably still in the
// gym, above it they have almost certainly finished and forgotten to say so.
const LEFT_OPEN_AFTER_SECONDS = 60 * 60

/**
 * The one Session a Client has open, offered back to them.
 *
 * This is the whole of ADR 0003's cleanup: there is no abandoned state and no
 * job that sweeps stale Sessions, because the Client who left one open is
 * exactly the person who knows whether it was real. They are asked the next time
 * they open their workouts, and until they answer, starting anything else is
 * blocked - which is the point, since a second Session would fragment one
 * workout across two half-finished records.
 *
 * The heading changes with age rather than always crying "left open". A Session
 * started four minutes ago is not forgotten, it is happening, and telling a
 * Client mid-workout that they forgot something is both wrong and alarming.
 *
 * The whole banner changes with it. In progress is drawn in the accent, which
 * says "fine" and is true; left open is amber - the same "worth a look" the
 * Modified verdict uses, and deliberately not `warning`, because nothing has
 * gone wrong and nothing is lost. There is just a decision waiting, and it is
 * blocking every other workout until it is made.
 */
const ActiveSessionBanner = ({ session, onResume, onDiscard, discarding }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light
    const [confirming, setConfirming] = useState(false)

    if (!session) return null

    const elapsed = elapsedSecondsBetween(session.startedAt?.toMillis?.())
    const stale = elapsed >= LEFT_OPEN_AFTER_SECONDS
    const accent = stale ? theme.amber : theme.iconColorFocused
    const tint = stale ? theme.amberTint : theme.accentTint
    // A Self-Directed Session has no Template name to give, so it says what it
    // is rather than borrowing a heading it never had.
    const name = session.templateName || 'Session without a plan'

    return (
        <View style={[styles.banner, { backgroundColor: tint, borderColor: accent }]}>
            <SectionLabel style={{ color: accent }}>
                {stale ? 'SESSION LEFT OPEN' : 'SESSION IN PROGRESS'}
            </SectionLabel>
            <Spacer height={4} />
            <ThemedText variant="cardTitle" tone="title">
                {name}
            </ThemedText>
            <ThemedText variant="meta" tone="muted">Started {formatAgo(elapsed)}</ThemedText>

            <Spacer height={Space.sm} />
            {!confirming ? (
                <View style={styles.actions}>
                    <ThemedButton onPress={onResume} style={styles.action}>
                        <ThemedText variant="small" tone="onPrimary" style={styles.label}>
                            Resume
                        </ThemedText>
                    </ThemedButton>
                    <ThemedButton
                        variant="danger"
                        onPress={() => setConfirming(true)}
                        style={styles.action}
                    >
                        <ThemedText variant="small" style={[styles.label, { color: buttonTextColor('danger', theme) }]}>
                            Discard
                        </ThemedText>
                    </ThemedButton>
                </View>
            ) : (
                <View>
                    {/* Named plainly, because discarding really does throw the
                        document away - and because a Client who trained for an
                        hour and tapped the wrong word deserves the sentence
                        that stops them. Nothing performed was ever written to
                        an active Session, so there is nothing else to warn
                        about. */}
                    <ThemedText variant="meta" tone="body">
                        Discard this session? Anything you checked off is lost.
                    </ThemedText>
                    <Spacer height={Space.xs + 4} />
                    <View style={styles.actions}>
                        <ThemedButton
                            variant="danger"
                            onPress={onDiscard}
                            disabled={discarding}
                            style={styles.action}
                        >
                            <ThemedText variant="small" style={[styles.label, { color: buttonTextColor('danger', theme) }]}>
                                {discarding ? 'Discarding...' : 'Yes, discard'}
                            </ThemedText>
                        </ThemedButton>
                        <ThemedButton
                            variant="ghost"
                            onPress={() => setConfirming(false)}
                            disabled={discarding}
                            style={styles.action}
                        >
                            <ThemedText variant="small" tone="body" style={styles.label}>
                                Keep it
                            </ThemedText>
                        </ThemedButton>
                    </View>
                </View>
            )}
        </View>
    )
}

export default ActiveSessionBanner

const styles = StyleSheet.create({
    banner: {
        borderRadius: Radius.card,
        borderWidth: 1,
        padding: Space.md,
        marginBottom: Space.lg,
    },
    actions: {
        flexDirection: 'row',
        gap: Space.sm,
    },
    action: {
        flex: 1,
        padding: Space.sm,
    },
    label: {
        fontWeight: '600',
    },
})
