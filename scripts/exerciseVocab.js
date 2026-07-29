// The closed vocabularies behind constants/exercises.json.
//
// Every tag is `facet:value` and every value must appear here - a typo'd tag is a
// silently unfilterable exercise, which is exactly how the v1 catalog rotted. The
// facets split apart two things v1's single `category` field conflated: what job a
// movement does in a session (`role:`) and how it is trained (`modality:`).

// Which set fields a movement takes. Order is the order inputs render in.
const FIELDS = ['weightKg', 'reps', 'distanceMeters', 'durationSeconds']

const MUSCLES = [
    'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'tibialis',
    'lower-back', 'lats', 'upper-back', 'traps', 'chest',
    'front-delts', 'side-delts', 'rear-delts', 'rotator-cuff',
    'biceps', 'triceps', 'forearms',
    'abs', 'obliques', 'hip-flexors', 'neck', 'full-body',
]

// Movement pattern only - how the body moves, not how hard or with what.
const PATTERNS = [
    'squat', 'hinge', 'lunge', 'single-leg',
    'horizontal-push', 'vertical-push', 'horizontal-pull', 'vertical-pull',
    'carry', 'rotation', 'anti-rotation', 'anti-extension', 'anti-lateral-flexion',
    'isolation', 'gait', 'jump', 'throw', 'hang',
]

// How it is trained. Mirrors the Warmup/Workout `Type` column in the program sheets.
const MODALITIES = [
    'resistance', 'cardio', 'mobility', 'stretch', 'yoga',
    'plyometric', 'isometric', 'balance',
]

// What job it does in a session.
const ROLES = [
    'compound', 'accessory', 'isolation', 'power', 'potentiation',
    'core', 'prehab', 'warmup', 'cooldown', 'conditioning',
]

const EQUIPMENT = [
    'none', 'bodyweight', 'barbell', 'ez-bar', 'dumbbell', 'kettlebell', 'plate',
    'cable', 'machine', 'smith-machine', 'landmine', 'sled',
    'band', 'rings', 'trx', 'ab-wheel', 'dip-bar', 'pull-up-bar', 'bench', 'box',
    'medicine-ball', 'slam-ball', 'slider', 'foam-roller', 'yoga-block', 'yoga-mat',
    'weight-vest', 'dip-belt', 'jump-rope', 'battle-rope', 'bosu',
    'assault-bike', 'rower', 'ski-erg', 'treadmill', 'elliptical',
    'stationary-bike', 'stairmaster',
]

const FACETS = {
    muscle: MUSCLES,
    pattern: PATTERNS,
    modality: MODALITIES,
    role: ROLES,
    equipment: EQUIPMENT,
}

// Abbreviations that stay abbreviated in the slug but are spelled out in `name`.
// Keep in sync with ABBREVIATIONS in utils/exerciseSearch.js.
const SLUG_ABBREVIATIONS = {
    dumbbell: 'db',
    barbell: 'bb',
    kettlebell: 'kb',
    'single-arm': 'sa',
    'single-leg': 'sl',
    'romanian-deadlift': 'rdl',
    'overhead-press': 'ohp',
    "worlds-greatest-stretch": 'wgs',
    'smith-machine': 'sm',
}

module.exports = { FIELDS, FACETS, MUSCLES, PATTERNS, MODALITIES, ROLES, EQUIPMENT, SLUG_ABBREVIATIONS }
