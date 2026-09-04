import ThemedChip from './ThemedChip'
import { verdictLabel } from '../utils/prescription'

/**
 * As Prescribed or Modified, and nothing at all otherwise.
 *
 * Renders null rather than a placeholder for a Session with no verdict: a
 * Self-Directed Session was never asked anything, and a badge saying so would
 * imply a third grade exists (ADR 0005). The same goes for a prescribed Session
 * whose Version could not be read at completion - it was not judged, and
 * inventing a mark for it would be a claim we never made.
 *
 * Where a row wants to say "this one had no plan", that is `SessionKindChip`
 * below, and it is deliberately a different component: it reports whether the
 * Session cited a Template, which is a fact about the Session, not a grade
 * awarded to it. Drawn muted rather than in a verdict colour for the same
 * reason - it is not a third place on the podium.
 *
 * Modified is not an error, so it is not drawn as one. Most Sessions will be
 * Modified by design - the verdict answers "is this worth opening?", not "was
 * this good" - and colouring it with `warning` would tell every Client who
 * changed a single rep that they had done something wrong.
 */
const VerdictBadge = ({ verdict }: { verdict?: string | null }) => {
    const label = verdictLabel(verdict)
    if (!label) return null

    return <ThemedChip label={label} tone={verdict === 'as-prescribed' ? 'accent' : 'amber'} />
}

export default VerdictBadge

/**
 * The chip a row shows when there is no verdict to show.
 *
 * A Session with a Template gets a verdict and this renders nothing; one without
 * gets "Self-directed", which says why there is no verdict rather than leaving a
 * gap the reader has to interpret. Keyed on `templateId` and not on the absent
 * verdict, deliberately: a prescribed Session whose Version never reached the
 * phone also has no verdict, and calling that one self-directed would be a lie
 * about what the Client set out to do.
 */
export const SessionKindChip = ({ session }: { session: any }) =>
    session?.templateId ? null : <ThemedChip label="Self-directed" tone="muted" />
