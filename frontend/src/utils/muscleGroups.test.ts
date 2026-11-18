import { afterEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import en from '../i18n/locales/en.json'
import pl from '../i18n/locales/pl.json'
import { MUSCLE_GROUPS, MUSCLE_PARENTS, muscleGroupLabel, muscleParentLabel } from './muscleGroups'

describe('muscleGroupLabel', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('covers the 18 backend groups in order', () => {
    expect([...MUSCLE_GROUPS]).toEqual([
      'CHEST', 'LATS', 'TRAPS', 'LOWER_BACK', 'FRONT_DELTS', 'SIDE_DELTS', 'REAR_DELTS', 'BICEPS',
      'TRICEPS', 'FOREARMS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'ADDUCTORS', 'ABDUCTORS', 'CALVES',
      'ABS', 'OBLIQUES',
    ])
  })

  it.each([
    ['en', en],
    ['pl', pl],
  ])('has a non-empty label in %s and returns it in the active language', async (lang, resource) => {
    await i18n.changeLanguage(lang)
    const labels = resource.muscle as Record<string, string>
    for (const group of MUSCLE_GROUPS) {
      expect(labels[group]?.trim()).toBeTruthy()
      expect(muscleGroupLabel(group)).toBe(labels[group])
    }
    expect(Object.keys(labels)).toEqual([...MUSCLE_GROUPS])
  })
})

describe('MUSCLE_PARENTS', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('puts every muscle group under exactly one parent, in enum order within each parent', () => {
    const listed: string[] = MUSCLE_PARENTS.flatMap((parent) => [...parent.groups])
    expect([...listed].sort()).toEqual([...MUSCLE_GROUPS].sort())
    expect(new Set(listed).size).toBe(listed.length)
    for (const parent of MUSCLE_PARENTS) {
      const positions = parent.groups.map((group) => MUSCLE_GROUPS.indexOf(group))
      expect(positions, parent.key).toEqual([...positions].sort((a, b) => a - b))
    }
  })

  it('groups the shoulders and the back as requested', () => {
    const groupsOf = (key: string) => MUSCLE_PARENTS.find((parent) => parent.key === key)!.groups
    expect([...groupsOf('SHOULDERS')]).toEqual(['FRONT_DELTS', 'SIDE_DELTS', 'REAR_DELTS'])
    expect([...groupsOf('BACK')]).toEqual(['LATS', 'TRAPS', 'LOWER_BACK'])
    expect([...groupsOf('ARMS')]).toContain('FOREARMS')
  })

  it.each([
    ['en', en],
    ['pl', pl],
  ])('has a non-empty parent label in %s for every parent', async (lang, resource) => {
    await i18n.changeLanguage(lang)
    const labels = resource.muscleStats.parent as Record<string, string>
    for (const parent of MUSCLE_PARENTS) {
      expect(labels[parent.key]?.trim(), parent.key).toBeTruthy()
      expect(muscleParentLabel(parent.key)).toBe(labels[parent.key])
    }
    expect(Object.keys(labels).sort()).toEqual(MUSCLE_PARENTS.map((parent) => parent.key).sort())
  })
})
