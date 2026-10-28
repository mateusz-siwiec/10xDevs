import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import i18n from '../i18n'
import { translateError } from './errors'

describe('translateError', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('translates known error codes in the active language', async () => {
    const err = new ApiError('Exercise not found', 404, { code: 'EXERCISE_NOT_FOUND' })
    expect(translateError(err)).toBe('Exercise not found.')
    await i18n.changeLanguage('pl')
    expect(translateError(err)).toBe('Nie znaleziono ćwiczenia.')
  })

  it('translates validation failures by rule', async () => {
    const err = new ApiError('email must be a well-formed email address', 400, {
      code: 'VALIDATION_FAILED',
      field: 'email',
      rule: 'Email',
    })
    expect(translateError(err)).toBe('Enter a valid email address.')
    const size = new ApiError('password size must be between 8 and 72', 400, {
      code: 'VALIDATION_FAILED',
      field: 'password',
      rule: 'Size',
    })
    await i18n.changeLanguage('pl')
    expect(translateError(size)).toBe('Pole „Hasło” ma nieprawidłową długość.')
  })

  it('falls back to the English message for unknown codes and rules', () => {
    expect(translateError(new ApiError('Boom', 500, { code: 'SOMETHING_NEW' }))).toBe('Boom')
    expect(
      translateError(new ApiError('x is odd', 400, { code: 'VALIDATION_FAILED', field: 'x', rule: 'Odd' })),
    ).toBe('x is odd')
  })

  it('uses the translated fallback for non-errors and null without one', () => {
    expect(translateError('nope', 'common.retry')).toBe('Retry')
    expect(translateError('nope')).toBeNull()
  })
})
