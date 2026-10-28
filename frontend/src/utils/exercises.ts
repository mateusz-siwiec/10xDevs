import i18n from '../i18n'

// Keys are built at runtime from the exercise slug, so they cannot satisfy the generated key types.
const translate = i18n.t.bind(i18n) as unknown as (key: string) => string

export interface NamedExercise {
  slug: string
  name: string
}

/**
 * Display name of an exercise in the active language. Seeded exercises have an `exercises.<slug>`
 * translation; custom ones (slug `custom-<uuid>`) never match a key and keep the name as typed.
 * Reads the i18n instance at call time, so callers must re-render on language change.
 */
export function exerciseName({ slug, name }: NamedExercise): string {
  const key = `exercises.${slug}`
  return i18n.exists(key) ? translate(key) : name
}

/** Returns a copy sorted alphabetically by display name under the active language's rules. */
export function sortExercisesByName<T extends NamedExercise>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => exerciseName(a).localeCompare(exerciseName(b), i18n.language))
}
