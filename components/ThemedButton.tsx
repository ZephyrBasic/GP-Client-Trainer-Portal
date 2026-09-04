import {
    Pressable,
    StyleSheet,
    useColorScheme,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native'
import { Colors } from '../constants/Colors'
import { Radius, Space } from '../constants/Layout'

/**
 * Three weights of action, and which one a button is says how much it is asking.
 *
 *   primary  the thing this screen is for - filled at the button radius, ink
 *            flips per theme (`onPrimary`) since the fill itself does
 *   ghost    a real alternative, not a lesser one - a hairline pill, nothing filled
 *   danger   destructive - a hairline pill in red, text in red, still not filled
 *
 * Ghost and danger are outlines rather than fills on purpose. A screen has at
 * most one filled button; the moment a second appears the first stops reading as
 * the answer. Danger in particular is an outline because a solid red block is
 * the loudest thing the palette can draw, and "discard this session" should be
 * possible to find without being the first thing the eye lands on.
 *
 * The two shapes carry the same story: primary sits at the 12px button radius,
 * everything else at the full pill - so which button is the answer is legible
 * from silhouette alone, not just colour.
 *
 * `style` is narrowed to a plain style object rather than Pressable's
 * style-or-callback union: this component already owns the callback form in
 * order to fold in the pressed and disabled states, and callers only ever append.
 */
export type ButtonVariant = 'primary' | 'ghost' | 'danger'

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
    variant === 'primary' ? theme.onPrimary : variant === 'danger' ? theme.danger : theme.text

const ThemedButton = ({ style, disabled, variant = 'primary', ...props }: ThemedButtonProps) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const skin =
        variant === 'primary'
            ? { backgroundColor: theme.primary, borderColor: theme.primary }
            : variant === 'danger'
              ? { backgroundColor: 'transparent', borderColor: theme.dangerTint }
              : { backgroundColor: 'transparent', borderColor: theme.line }

    return (
        <Pressable
            style={({ pressed }) => [
                styles.btn,
                variant === 'primary' ? styles.filled : styles.outline,
                skin,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
                style,
            ]}
            disabled={disabled}
            {...props}
        />
    )
}
export default ThemedButton

const styles = StyleSheet.create({
    btn: {
        padding: Space.md,
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
    },
    filled: {
        borderRadius: Radius.button,
    },
    outline: {
        borderRadius: Radius.pill,
    },
    pressed: {
        opacity: 0.8,
    },
    disabled: {
        opacity: 0.5,
    },
})
