import { afterEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { exerciseTechnique, matchesExerciseSearch } from './exercises'

describe('matchesExerciseSearch', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  const bench = { slug: 'barbell-bench-press', name: 'Barbell Bench Press' }

  it('ignores case', async () => {
    await i18n.changeLanguage('en')
    expect(matchesExerciseSearch(bench, 'BENCH')).toBe(true)
    expect(matchesExerciseSearch(bench, 'squat')).toBe(false)
  })

  it('matches a substring in the middle of the name', async () => {
    await i18n.changeLanguage('en')
    expect(matchesExerciseSearch(bench, 'bell ben')).toBe(true)
  })

  it('matches everything for an empty or whitespace-only query', () => {
    expect(matchesExerciseSearch(bench, '')).toBe(true)
    expect(matchesExerciseSearch(bench, '   ')).toBe(true)
  })

  it('trims the query', async () => {
    await i18n.changeLanguage('en')
    expect(matchesExerciseSearch(bench, '  bench ')).toBe(true)
  })

  it('ignores Polish diacritics in both name and query', () => {
    const custom = { slug: 'custom-1', name: 'Zażółć gęślą jaźń ćwiczenie' }
    expect(matchesExerciseSearch(custom, 'zazolc gesla jazn cwiczenie')).toBe(true)
    expect(matchesExerciseSearch({ slug: 'custom-2', name: 'Zazolc' }, 'ZAŻÓŁĆ')).toBe(true)
    for (const letter of ['ą', 'ę', 'ó', 'ś', 'ć', 'ż', 'ź', 'ń']) {
      expect(matchesExerciseSearch({ slug: 'custom-3', name: `x${letter}y` }, `x${letter}`)).toBe(true)
    }
  })

  it('maps ł to l', () => {
    expect(matchesExerciseSearch({ slug: 'custom-4', name: 'Łydki' }, 'lyd')).toBe(true)
    expect(matchesExerciseSearch({ slug: 'custom-5', name: 'Lydki' }, 'łyd')).toBe(true)
  })

  it('matches the displayed name in the active language', async () => {
    await i18n.changeLanguage('pl')
    expect(matchesExerciseSearch(bench, 'wyciskanie')).toBe(true)
    expect(matchesExerciseSearch(bench, 'bench')).toBe(false)
    await i18n.changeLanguage('en')
    expect(matchesExerciseSearch(bench, 'bench')).toBe(true)
    expect(matchesExerciseSearch(bench, 'wyciskanie')).toBe(false)
  })

  it('matches a custom exercise by the name as typed', () => {
    expect(matchesExerciseSearch({ slug: 'custom-abc', name: 'My Cable Curl' }, 'cable')).toBe(true)
  })
})

describe('exerciseTechnique', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('returns the cue list of a seeded exercise in the active language', async () => {
    await i18n.changeLanguage('en')
    const en = exerciseTechnique({ slug: 'barbell-bench-press' })
    expect(en).toBeInstanceOf(Array)
    expect(en!.length).toBeGreaterThanOrEqual(3)

    await i18n.changeLanguage('pl')
    const pl = exerciseTechnique({ slug: 'barbell-bench-press' })
    expect(pl).toBeInstanceOf(Array)
    expect(pl).not.toEqual(en)
  })

  it('returns null for a custom exercise', () => {
    expect(exerciseTechnique({ slug: 'custom-123' })).toBeNull()
  })
})
