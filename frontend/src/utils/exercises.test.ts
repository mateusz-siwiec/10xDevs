import { afterEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { exerciseTechnique } from './exercises'

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
