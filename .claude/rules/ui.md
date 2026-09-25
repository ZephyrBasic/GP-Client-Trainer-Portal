---
paths: ["app/**", "components/**", "constants/Colors.ts", "constants/Motion.ts"]
---
# UI

- Use the themed primitives (`Themed*`, `ThemedChip`, `SectionLabel`, `ScreenSubtitle`, `Spacer`)
  before writing a per-screen style. No six-digit hex outside `constants/Colors.ts`.
- While a read is loading, render `PlaceholderRows`/`PlaceholderInline`, never "Loading...".
- Sheets use `components/BottomSheet.tsx`. Motion timings come from `constants/Motion.ts` and respect
  `useReducedMotion`.
- Route auth errors through `utils/firebaseErrors.ts`.
- Routing guard is declarative (`useProtectedRoute` returns a `<Redirect>`). Never use an
  imperative `router.replace()` in an effect. Folder tabs set `headerShown: false`.
- `YouTubePlayer.tsx` native path can't be tested on web; it needs a device.
- Forms: on a failed submit, show every error under its own field and focus the first invalid one.
  Clear a field's error when it changes (`components/FieldError.tsx`).
