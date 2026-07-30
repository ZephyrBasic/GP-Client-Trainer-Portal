// ----------------------------------------------------------------------------
// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Source:    scripts/exerciseVocab.js
// Regenerate: node scripts/generate-exercise-types.js
// Verify:     node scripts/generate-exercise-types.js --check
//
// Edit the vocabulary in scripts/exerciseVocab.js and regenerate. Editing this
// file directly makes the types disagree with the validator, which is the exact
// failure mode generating it was meant to remove.
// ----------------------------------------------------------------------------

/**
 * Which measurements a set of this exercise takes.
 *
 * The order here is the order the inputs render in, and validate-exercises.js
 * enforces that a record's `fields` array follows it.
 */
export type SetField =
    | 'weightKg'
    | 'reps'
    | 'distanceMeters'
    | 'durationSeconds'

/** What the movement trains. Facet `muscle:`. */
export type Muscle =
    | 'quads'
    | 'hamstrings'
    | 'glutes'
    | 'adductors'
    | 'abductors'
    | 'calves'
    | 'tibialis'
    | 'lower-back'
    | 'lats'
    | 'upper-back'
    | 'traps'
    | 'chest'
    | 'front-delts'
    | 'side-delts'
    | 'rear-delts'
    | 'rotator-cuff'
    | 'biceps'
    | 'triceps'
    | 'forearms'
    | 'abs'
    | 'obliques'
    | 'hip-flexors'
    | 'neck'
    | 'full-body'

/** How the body moves - not how hard, and not with what. Facet `pattern:`. */
export type Pattern =
    | 'squat'
    | 'hinge'
    | 'lunge'
    | 'single-leg'
    | 'horizontal-push'
    | 'vertical-push'
    | 'horizontal-pull'
    | 'vertical-pull'
    | 'carry'
    | 'rotation'
    | 'anti-rotation'
    | 'anti-extension'
    | 'anti-lateral-flexion'
    | 'isolation'
    | 'gait'
    | 'jump'
    | 'throw'
    | 'hang'

/** How it is trained. Facet `modality:`. */
export type Modality =
    | 'resistance'
    | 'cardio'
    | 'mobility'
    | 'stretch'
    | 'yoga'
    | 'plyometric'
    | 'isometric'
    | 'balance'

/** What job it does in a session. Facet `role:`. */
export type Role =
    | 'compound'
    | 'accessory'
    | 'isolation'
    | 'power'
    | 'potentiation'
    | 'core'
    | 'prehab'
    | 'warmup'
    | 'cooldown'
    | 'conditioning'

/** What it needs. Facet `equipment:`. */
export type Equipment =
    | 'none'
    | 'bodyweight'
    | 'barbell'
    | 'ez-bar'
    | 'dumbbell'
    | 'kettlebell'
    | 'plate'
    | 'cable'
    | 'machine'
    | 'smith-machine'
    | 'landmine'
    | 'sled'
    | 'band'
    | 'rings'
    | 'trx'
    | 'ab-wheel'
    | 'dip-bar'
    | 'pull-up-bar'
    | 'bench'
    | 'box'
    | 'medicine-ball'
    | 'slam-ball'
    | 'slider'
    | 'foam-roller'
    | 'yoga-block'
    | 'yoga-mat'
    | 'weight-vest'
    | 'dip-belt'
    | 'jump-rope'
    | 'battle-rope'
    | 'bosu'
    | 'assault-bike'
    | 'rower'
    | 'ski-erg'
    | 'treadmill'
    | 'elliptical'
    | 'stationary-bike'
    | 'stairmaster'

/**
 * A tag is always `facet:value`, and both halves are closed.
 *
 * Template literal types are what make this worth generating: `ExerciseTag`
 * rejects 'muscle:quadz' at compile time rather than leaving it to be caught by
 * validate-exercises.js, or not caught at all in code that builds tags itself.
 */
export type MuscleTag = `muscle:${Muscle}`
export type PatternTag = `pattern:${Pattern}`
export type ModalityTag = `modality:${Modality}`
export type RoleTag = `role:${Role}`
export type EquipmentTag = `equipment:${Equipment}`

export type ExerciseTag = MuscleTag | PatternTag | ModalityTag | RoleTag | EquipmentTag

/** The facet prefixes, for code that parses a tag back apart. */
export type Facet = 'muscle' | 'pattern' | 'modality' | 'role' | 'equipment'

/** Maps a facet to its value union, so a filter can be typed per-facet. */
export interface FacetValues {
    muscle: Muscle
    pattern: Pattern
    modality: Modality
    role: Role
    equipment: Equipment
}
