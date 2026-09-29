// A Trainer opening one of their Client's Sessions from the Client's history.
//
// The same screen a Client sees for their own, so a Trainer reads every Set
// performed and the Client's notes - the history row used to expand only the
// differences from the plan, and notes were visible nowhere. Re-exported
// rather than rebuilt so the two cannot drift; the rules already let a linked
// Trainer read the document, and the screen hides what only the owner may do.
export { default } from '../../../workouts/[id]'
