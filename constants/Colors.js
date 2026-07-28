// GreenPulse brand palette. `primary` is used directly as a button/link
// color in both themes, so it's kept dark enough (~4.9:1 contrast) for
// white button text to stay readable - the lighter accent greens below are
// only ever used for icons/highlights sitting directly on a themed
// background, not underneath white text.
export const Colors = {
    primary: '#15803D',
    warning: '#DC2626',

    dark: {
        text: '#C3D6CB',
        title: '#F1FBF6',
        background: '#0E1A14',
        navBackground: '#122019',
        iconColor: '#78998A',
        iconColorFocused: '#3DDC84',
        uiBackground: '#1A2E23',
    },
    light: {
        text: '#3F5449',
        title: '#122019',
        background: '#F0F8F3',
        navBackground: '#E4F1E9',
        iconColor: '#5C7A6B',
        iconColorFocused: '#15803D',
        uiBackground: '#D9ECE1',
    }
}
