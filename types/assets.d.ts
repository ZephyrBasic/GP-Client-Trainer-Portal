// Metro turns an image import into an asset reference, but nothing in
// expo/types declares the module shape, so tsc treats `import Logo from
// './logo.png'` as an unresolved module. This is the committed counterpart to
// the auto-generated (and gitignored) expo-env.d.ts.
//
// The value is whatever Metro hands to <Image source={...}>: a number on
// native, an object with a uri on web. `any` keeps both callers honest without
// pretending to know which platform is compiling.
declare module '*.png' {
    const content: any
    export default content
}

declare module '*.jpg' {
    const content: any
    export default content
}

declare module '*.jpeg' {
    const content: any
    export default content
}

declare module '*.gif' {
    const content: any
    export default content
}

declare module '*.svg' {
    const content: any
    export default content
}

declare module '*.webp' {
    const content: any
    export default content
}
