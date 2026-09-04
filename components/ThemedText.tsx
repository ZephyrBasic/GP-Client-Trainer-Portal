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
 * `title` and `meta` are the two boolean props this component shipped with
 * before Signal, and they stay - about thirty screens pass them, and none of
 * those screens has been touched yet. Both alias onto the token system rather
 * than being a separate code path: `title` is `variant="cardTitle"
 * tone="title"`, `meta` is `variant="meta" tone="muted"`. An explicit
 * `variant` or `tone` wins over either boolean, so a screen can be migrated
 * one prop at a time without the two ever fighting.
 */
const ThemedText = ({
    style,
    title = false,
    meta = false,
    variant,
    tone,
    ...props
}: TextProps & {
    title?: boolean
    meta?: boolean
    variant?: TextVariant
    tone?: TextTone
}) => {
    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    const resolvedVariant: TextVariant = variant ?? (title ? 'cardTitle' : meta ? 'meta' : 'body')
    const resolvedTone: TextTone = tone ?? (title ? 'title' : meta ? 'muted' : 'body')

    return (
        <Text
            style={[Type[resolvedVariant], { color: toneColor(theme, resolvedTone) }, style]}
            {...props}
        />
    )
}
export default ThemedText
