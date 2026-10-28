import i18n from '../i18n'

export const MUSCLE_GROUPS = [
  'CHEST',
  'BACK',
  'SHOULDERS',
  'BICEPS',
  'TRICEPS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'CORE',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

const translate = i18n.t.bind(i18n) as unknown as (key: string) => string

/** Label of a muscle group in the active language; unknown values are shown as received. */
export function muscleGroupLabel(group: string): string {
  const key = `muscle.${group}`
  return i18n.exists(key) ? translate(key) : group
}
