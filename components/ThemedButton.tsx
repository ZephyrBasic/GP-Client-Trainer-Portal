import {
    StyleSheet,
    useColorScheme,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native'
import Pressable from './Touchable'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'

/**
 * Three weights of action, and which one a button is says how much it is asking.
 *
 *   primary  the thing this screen is for - filled at the button radius, ink
 *            flips per theme (`onPrimary`) since the fill itself does
 *   ghost    a real alternative, not a lesser one - a hairline pill, nothing filled
 *   danger   destructive - a hairline pill in red, text in red, still not filled
 *   destructive  the answer to "are you sure?" - filled red at the button radius
 *
 * Ghost and danger are outlines rather than fills on purpose. A screen has at
 * most one filled button; the moment a second appears the first stops reading as
 * the answer. Danger in particular is an outline because a solid red block is
 * the loudest thing the palette can draw, and "discard this session" should be
 * possible to find without being the first thing the eye lands on.
 *
 * `destructive` is that loud block, kept for the one moment it is right: the
 * second tap of a confirm, where the Client has already asked to destroy
 * something and the filled button is now the answer. It is primary's shape in
 * danger's colour, and `onPrimary` inks it - both themes' danger is close
 * enough in value to their primary that the same ink reads on either.
 *
 * The two shapes carry the same story: primary sits at the 12px button radius,
 * everything else at the full pill - so which button is the answer is legible
 * from silhouette alone, not just colour.
 *
 * `style` is narrowed to a plain style object rather than Pressable's
 * style-or-callback union: this component already owns the callback form in
 * order to fold in the disabled state; pressed feedback is Touchable's state layer.
 */
export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'destructive'

type ThemedButtonProps = Omit<PressableProps, 'style'> & {
    style?: StyleProp<ViewStyle>
    variant?: ButtonVariant
}

/**
 * The text colour a button's own label should take, exported so a caller can
 * put it on the ThemedText it passes as a child.
 *
 * Handed out rather than applied here, because the child is the caller's - some
 * buttons carry a row of things rather than one label, and a component that
 * reached into its children to recolour them would be guessing.
 */
export const buttonTextColor = (variant: ButtonVariant, theme: (typeof Colors)['dark']) =>
    variant === 'primary' || variant === 'destructive'
        ? theme.onPrimary
        : variant === 'danger'
          ? theme.danger
          : theme.text

const ThemedButton = ({ style, disabled, variant = 'primary', ...props }: ThemedButtonProps) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const filled = variant === 'primary' || variant === 'destructive'

    // Outlines use `outline`, not the `line` hairline: a button's edge has to
    // clear 3:1 against the page (WCAG 1.4.11), and at `line` "Add set" and
    // "Keep training" read as faint shapes rather than buttons.
    //
    // Disabled swaps the fill for grey rather than fading the green: a faded
    // green still reads as pressable, which Material's disabled treatment
    // (a neutral container) exists to avoid.
    const skin = disabled && filled
        ? { backgroundColor: theme.faint, borderColor: theme.faint }
        : variant === 'primary'
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : variant === 'destructive'
            ? { backgroundColor: theme.danger, borderColor: theme.danger }
            : variant === 'danger'
              ? { backgroundColor: 'transparent', borderColor: theme.danger }
              : { backgroundColor: 'transparent', borderColor: theme.outline }

    return (
        <Pressable
            style={[
                styles.btn,
                filled ? styles.filled : styles.outline,
                (variant === 'danger' || variant === 'destructive') && styles.tall,
                skin,
                disabled && styles.disabled,
                style,
            ]}
            // The pressed tint is mixed from the label's colour, so it shows
            // on a green fill as well as on an empty outline.
            stateColor={filled ? theme.onPrimary : undefined}
            disabled={disabled}
            accessibilityState={{ disabled: Boolean(disabled) }}
            {...props}
        />
    )
}
export default ThemedButton

const styles = StyleSheet.create({
    btn: {
        paddingHorizontal: Space.md,
        paddingVertical: Space.sm + 2,
        borderWidth: 1,
        // Both axes. `alignItems` alone centred the label horizontally and left
        // it stacked from the top, which is invisible on a button sized by its
        // own padding - every button here but one - and glaring on the live
        // Session's FINISH, which sets a fixed height to match the back button
        // beside it and zeroes the padding to do it. Centring belongs here
        // rather than on that one caller: a button that does not centre its own
        // label is the surprising thing, and the next fixed-height button would
        // have hit this too.
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        // 44, Apple's floor; the live Session and anything destructive keep
        // 48 (UI review decision 5) - see `tall` below.
        minHeight: 44,
    },
    tall: {
        minHeight: 48,
    },
    filled: {
        borderRadius: Radius.button,
    },
    outline: {
        borderRadius: Radius.pill,
    },
    disabled: {
        opacity: 0.6,
    },
})
