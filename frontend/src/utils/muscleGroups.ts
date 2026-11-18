import i18n from '../i18n'

export const MUSCLE_GROUPS = [
  'CHEST',
  'LATS',
  'TRAPS',
  'LOWER_BACK',
  'FRONT_DELTS',
  'SIDE_DELTS',
  'REAR_DELTS',
  'BICEPS',
  'TRICEPS',
  'FOREARMS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'ADDUCTORS',
  'ABDUCTORS',
  'CALVES',
  'ABS',
  'OBLIQUES',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

/** Parent rows of the muscle stats page; each lists the groups it sums, in display order. */
export const MUSCLE_PARENTS = [
  { key: 'CHEST', groups: ['CHEST'] },
  { key: 'BACK', groups: ['LATS', 'TRAPS', 'LOWER_BACK'] },
  { key: 'SHOULDERS', groups: ['FRONT_DELTS', 'SIDE_DELTS', 'REAR_DELTS'] },
  { key: 'ARMS', groups: ['BICEPS', 'TRICEPS', 'FOREARMS'] },
  { key: 'LEGS', groups: ['QUADS', 'HAMSTRINGS', 'GLUTES', 'ADDUCTORS', 'ABDUCTORS', 'CALVES'] },
  { key: 'CORE', groups: ['ABS', 'OBLIQUES'] },
] as const satisfies readonly { key: string; groups: readonly MuscleGroup[] }[]

export type MuscleParentKey = (typeof MUSCLE_PARENTS)[number]['key']

const translate = i18n.t.bind(i18n) as unknown as (key: string) => string

/** Label of a stats parent row in the active language. */
export function muscleParentLabel(key: MuscleParentKey): string {
  return translate(`muscleStats.parent.${key}`)
}

/** Label of a muscle group in the active language; unknown values are shown as received. */
export function muscleGroupLabel(group: string): string {
  const key = `muscle.${group}`
  return i18n.exists(key) ? translate(key) : group
}
