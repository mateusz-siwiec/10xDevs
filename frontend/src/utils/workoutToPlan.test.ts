import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { formatDate } from './format'
import { defaultPlanName, exceedsPlanLimits, workoutToPlanEntries } from './workoutToPlan'

const set = (exerciseId: string, reps: number) => ({ exerciseId, reps })

describe('workoutToPlanEntries', () => {
  it('returns no entries for an empty workout', () => {
    expect(workoutToPlanEntries([])).toEqual([])
  })

  it('makes one entry per exercise with set count and reps', () => {
    expect(workoutToPlanEntries([set('a', 10), set('a', 10), set('a', 10), set('b', 8)])).toEqual([
      { exerciseId: 'a', sets: 3, reps: 10 },
      { exerciseId: 'b', sets: 1, reps: 8 },
    ])
  })

  it('keeps an exercise revisited later as a separate entry, in workout order', () => {
    const entries = workoutToPlanEntries([set('a', 10), set('b', 8), set('a', 12)])
    expect(entries.map((e) => e.exerciseId)).toEqual(['a', 'b', 'a'])
    expect(entries[2]).toEqual({ exerciseId: 'a', sets: 1, reps: 12 })
  })

  it('uses the most common rep count, ignoring a single odd set', () => {
    expect(workoutToPlanEntries([set('a', 10), set('a', 10), set('a', 6)])[0].reps).toBe(10)
  })

  it('breaks rep-count ties towards the higher value', () => {
    expect(workoutToPlanEntries([set('a', 12), set('a', 10), set('a', 8)])[0].reps).toBe(12)
    expect(workoutToPlanEntries([set('a', 8), set('a', 8), set('a', 12), set('a', 12)])[0].reps).toBe(12)
  })

  it('caps sets at 20 and reps within 1-100', () => {
    const many = Array.from({ length: 25 }, () => set('a', 150))
    expect(workoutToPlanEntries(many)[0]).toEqual({ exerciseId: 'a', sets: 20, reps: 100 })
    expect(workoutToPlanEntries([set('a', 0)])[0].reps).toBe(1)
  })

  it('keeps only the first 50 entries', () => {
    const sets = Array.from({ length: 60 }, (_, i) => set(`ex-${i}`, 10))
    const entries = workoutToPlanEntries(sets)
    expect(entries).toHaveLength(50)
    expect(entries[49].exerciseId).toBe('ex-49')
  })
})

describe('defaultPlanName', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('prefers the source plan name', () => {
    expect(defaultPlanName('Push day', '2026-11-03T10:00:00Z')).toBe('Push day')
  })

  it('falls back to the workout date', () => {
    // Compared with formatDate itself: the rendered day depends on the runner's timezone.
    const expected = formatDate('2026-11-03T12:00:00Z')
    expect(defaultPlanName(null, '2026-11-03T12:00:00Z')).toBe(expected)
    expect(defaultPlanName('  ', '2026-11-03T12:00:00Z')).toBe(expected)
  })

  it('truncates to the 60 character plan name limit', () => {
    expect(defaultPlanName('x'.repeat(80), '2026-11-03T10:00:00Z')).toHaveLength(60)
  })
})

describe('exceedsPlanLimits', () => {
  it('is false for a workout within the plan limits', () => {
    expect(exceedsPlanLimits([set('a', 10), set('b', 8)])).toBe(false)
    expect(exceedsPlanLimits([])).toBe(false)
  })

  it('is true when a run has more than 20 sets', () => {
    expect(exceedsPlanLimits(Array.from({ length: 21 }, () => set('a', 10)))).toBe(true)
  })

  it('is true when there are more than 50 exercise runs', () => {
    expect(exceedsPlanLimits(Array.from({ length: 51 }, (_, i) => set(`ex-${i}`, 10)))).toBe(true)
  })
})
