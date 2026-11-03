import { afterEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import en from '../i18n/locales/en.json'
import pl from '../i18n/locales/pl.json'
import { MUSCLE_GROUPS, muscleGroupLabel } from './muscleGroups'

describe('muscleGroupLabel', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('covers the 14 backend groups in order', () => {
    expect([...MUSCLE_GROUPS]).toEqual([
      'CHEST', 'LATS', 'TRAPS', 'LOWER_BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS',
      'FOREARMS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ABS', 'OBLIQUES',
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
