import type { ExerciseRecord } from '../types/exercise'
import raw from './exercises.json'

/**
 * The bundled catalog, typed.
 *
 * Import this rather than exercises.json directly: TypeScript infers the JSON
 * structurally, so a raw import gives `tags: string[]` and loses every closed
 * vocabulary the facets exist to enforce.
 *
 * The assertion is a narrowing one - it tells the compiler these strings are
 * from the closed sets, which it cannot verify from a .json file. That is not a
 * gap: `node scripts/validate-exercises.js` checks all 317 records against the
 * same vocabularies and exits non-zero, so the guarantee is real, it is just
 * enforced by the validator rather than by tsc. Keep running it after editing
 * the catalog.
 */
export const EXERCISES = raw as ExerciseRecord[]

export default EXERCISES
