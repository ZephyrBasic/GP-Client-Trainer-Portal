import { Text, useColorScheme, type TextProps } from 'react-native'
import { Colors } from '../constants/Colors'
import { Type } from '../constants/Type'

export type TextVariant = keyof typeof Type
export type TextTone = 'title' | 'body' | 'muted' | 'faint' | 'accent' | 'amber' | 'danger' | 'onPrimary'

const toneColor = (theme: (typeof Colors)['dark'], tone: TextTone) => {
    switch (tone) {
        case 'title':
            return theme.title
        case 'muted':
            return theme.iconColor
        case 'faint':
            return theme.faint
        case 'accent':
            return theme.iconColorFocused
        case 'amber':
            return theme.amber
        case 'danger':
            return theme.danger
        case 'onPrimary':
            return theme.onPrimary
        case 'body':
        default:
            return theme.text
    }
}

/**
 * `variant` picks a token from constants/Type.ts (typography only - family,
 * size, tracking); `tone` picks a colour. Kept separate rather than one
 * `size="titleAccent"`-style prop, because the two vary independently - a
 * screen title in the danger tone during a destructive confirm is still the
 * `title` variant.
 *
 * There were two boolean props here as well - `title` and `meta`, from before
 * Signal - kept while the redesign migrated the screens that passed them. It
 * finished, and the last five call sites are now spelled in the tokens like
 * everything else, so the aliases are gone: two ways to say `variant="meta"
 * tone="muted"` is one more than the design system needs.
 */
const ThemedText = ({
    style,
    variant = 'body',
    tone = 'body',
    ...props
}: TextProps & {
    variant?: TextVariant
    tone?: TextTone
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Text style={[Type[variant], { color: toneColor(theme, tone) }, style]} {...props} />
    )
}
export default ThemedText
