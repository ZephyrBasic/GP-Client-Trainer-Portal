import { Pressable, StyleSheet, View, useColorScheme, type PressableProps } from 'react-native'
import { Colors } from '../constants/Colors'

// How strongly the state layer tints what is under it. Material's figures
// (hover 8%, pressed 10-12%), lowered a touch for hover because a web cursor
// sweeping over a list should not make every row flash.
const HOVER_OPACITY = 0.06
const PRESSED_OPACITY = 0.12

type Props = PressableProps & {
    /**
     * The colour the pressed tint is mixed from. Defaults to the theme's title
     * ink, which darkens a light surface and lightens a dark one; a filled
     * button passes its own label colour so the tint shows on the fill.
     */
    stateColor?: string
}

/**
 * `Pressable` with a visible answer to a touch.
 *
 * The UI review found almost nothing in the app changed when pressed - roster
 * rows, history rows, chips, links and the set tick all looked identical held
 * down and untouched - so on a phone a tap read as a miss and got repeated.
 * This paints a translucent layer over the control while it is hovered or
 * pressed (Material's "state layer"), clipped to the control's own corners.
 *
 * A drop-in replacement: it takes everything Pressable does, including the
 * function forms of `style` and `children`. It also defaults
 * `accessibilityRole` to "button", since nearly every Pressable here is one and
 * without a role a screen reader announces it as plain text.
 */
const Touchable = ({ style, children, stateColor, disabled, accessibilityRole, ...props }: Props) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Pressable
            {...props}
            disabled={disabled}
            accessibilityRole={accessibilityRole ?? 'button'}
            style={(state) => [styles.clip, typeof style === 'function' ? style(state) : style]}
        >
            {(state) => {
                // RN-web adds `hovered`; native never sets it.
                const hovered = (state as { hovered?: boolean }).hovered
                const opacity = disabled ? 0 : state.pressed ? PRESSED_OPACITY : hovered ? HOVER_OPACITY : 0
                return (
                    <>
                        {typeof children === 'function' ? children(state) : children}
                        {opacity > 0 ? (
                            <View
                                pointerEvents="none"
                                style={[StyleSheet.absoluteFill, { backgroundColor: stateColor ?? theme.title, opacity }]}
                            />
                        ) : null}
                    </>
                )
            }}
        </Pressable>
    )
}

export default Touchable

const styles = StyleSheet.create({
    // Keeps the state layer inside rounded corners. Nothing here draws outside
    // its own box; the web focus ring is an outline, which overflow never clips.
    clip: {
        overflow: 'hidden',
    },
})
