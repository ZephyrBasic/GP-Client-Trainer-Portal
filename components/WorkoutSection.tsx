import { StyleSheet, View } from 'react-native'

import SectionLabel from './SectionLabel'
import Spacer from './Spacer'
import { Space } from '../constants/Layout'

/**
 * A labelled group of workouts on a Client's list.
 *
 * A Client's list has two sources - what their Trainer prescribed and what they
 * wrote themselves - and the label is the only thing that says which is which.
 * Without it the two are indistinguishable, and "is this mine or theirs?" is
 * exactly the question a Client asks before editing something.
 *
 * Rendered as plain views rather than a list: this sits inside the history
 * FlatList's header, and nesting a virtualised list inside another one is both a
 * React Native warning and pointless for a handful of rows.
 *
 * Renders nothing when empty. A heading over empty space is a claim that
 * something should be there, and a Client who has never been assigned anything
 * has not lost a workout.
 */
const WorkoutSection = ({ label, children }: { label: string; children?: any }) => {
    const rows = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : []
    if (rows.length === 0) return null

    return (
        <View>
            <SectionLabel>{label}</SectionLabel>
            <Spacer height={Space.sm} />
            <View style={styles.rows}>{rows}</View>
        </View>
    )
}

export default WorkoutSection

const styles = StyleSheet.create({
    rows: {
        gap: Space.sm,
    },
})
