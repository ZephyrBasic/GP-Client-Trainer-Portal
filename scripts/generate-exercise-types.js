#!/usr/bin/env node
// Generates types/exerciseVocab.generated.ts from the closed vocabularies in
// exerciseVocab.js.
//
//   node scripts/generate-exercise-types.js          # write the file
//   node scripts/generate-exercise-types.js --check  # fail if it is stale
//
// Why generate rather than hand-write the unions: exerciseVocab.js is the single
// source of truth and validate-exercises.js already enforces it at runtime. A
// hand-maintained copy of ~120 string literals in TypeScript would drift the
// first time a facet value is added, and it would drift silently - the catalog
// would still validate while the types quietly disagreed. Generating makes that
// impossible, and --check turns drift into a failed command.
//
// This stays plain .js, and stays out of tsconfig, for the same reason the rest
// of scripts/ does: it runs under bare `node` with no build step.

const fs = require('fs')
const path = require('path')

const { FIELDS, MUSCLES, PATTERNS, MODALITIES, ROLES, EQUIPMENT } = require('./exerciseVocab')

const OUT = path.join(__dirname, '..', 'types', 'exerciseVocab.generated.ts')

/** One literal per line, so a one-value change is a one-line diff. */
const union = (values) => values.map((v) => `    | '${v}'`).join('\n')

const banner = `// ----------------------------------------------------------------------------
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
`

const body = `${banner}
/**
 * Which measurements a set of this exercise takes.
 *
 * The order here is the order the inputs render in, and validate-exercises.js
 * enforces that a record's \`fields\` array follows it.
 */
export type SetField =
${union(FIELDS)}

/** What the movement trains. Facet \`muscle:\`. */
export type Muscle =
${union(MUSCLES)}

/** How the body moves - not how hard, and not with what. Facet \`pattern:\`. */
export type Pattern =
${union(PATTERNS)}

/** How it is trained. Facet \`modality:\`. */
export type Modality =
${union(MODALITIES)}

/** What job it does in a session. Facet \`role:\`. */
export type Role =
${union(ROLES)}

/** What it needs. Facet \`equipment:\`. */
export type Equipment =
${union(EQUIPMENT)}

/**
 * A tag is always \`facet:value\`, and both halves are closed.
 *
 * Template literal types are what make this worth generating: \`ExerciseTag\`
 * rejects 'muscle:quadz' at compile time rather than leaving it to be caught by
 * validate-exercises.js, or not caught at all in code that builds tags itself.
 */
export type MuscleTag = \`muscle:\${Muscle}\`
export type PatternTag = \`pattern:\${Pattern}\`
export type ModalityTag = \`modality:\${Modality}\`
export type RoleTag = \`role:\${Role}\`
export type EquipmentTag = \`equipment:\${Equipment}\`

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
`

const checkOnly = process.argv.includes('--check')

if (checkOnly) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
    if (current === body) {
        console.log('types/exerciseVocab.generated.ts is up to date')
        process.exit(0)
    }
    console.error(
        current === null
            ? 'FAIL: types/exerciseVocab.generated.ts is missing'
            : 'FAIL: types/exerciseVocab.generated.ts is stale'
    )
    console.error('Run: node scripts/generate-exercise-types.js')
    process.exit(1)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, body)
console.log(
    `types/exerciseVocab.generated.ts written ` +
        `(${FIELDS.length} fields, ${MUSCLES.length} muscles, ${PATTERNS.length} patterns, ` +
        `${MODALITIES.length} modalities, ${ROLES.length} roles, ${EQUIPMENT.length} equipment)`
)
