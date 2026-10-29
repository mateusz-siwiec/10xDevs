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
      min: 8,
      max: 72,
    })
    await i18n.changeLanguage('pl')
    expect(translateError(size)).toBe('Pole „Hasło” ma nieprawidłową długość (dozwolone: od 8 do 72).')
  })

  it('falls back to the English message for unknown codes and rules', () => {
    expect(translateError(new ApiError('Boom', 500, { code: 'SOMETHING_NEW' }))).toBe('Boom')
    expect(
      translateError(new ApiError('x is odd', 400, { code: 'VALIDATION_FAILED', field: 'x', rule: 'Odd' })),
    ).toBe('x is odd')
  })

  it('does not render namespace objects for rules or codes that name a locale group', () => {
    expect(
      translateError(new ApiError('bad', 400, { code: 'VALIDATION_FAILED', field: 'x', rule: 'fields' })),
    ).toBe('bad')
    expect(translateError(new ApiError('bad', 400, { code: 'validation' }))).toBe('bad')
  })

  it('maps a bodiless API failure to the translated generic message', async () => {
    const err = new ApiError('Request failed with status 502', 502, { code: 'REQUEST_FAILED' })
    expect(translateError(err)).toBe('Request failed (status 502).')
    await i18n.changeLanguage('pl')
    expect(translateError(err)).toBe('Żądanie nie powiodło się (status 502).')
  })

  it('uses the translated fallback for non-API errors and null without one', () => {
    expect(translateError('nope', 'common.retry')).toBe('Retry')
    expect(translateError(new TypeError('Failed to fetch'), 'common.retry')).toBe('Retry')
    expect(translateError(new TypeError('Failed to fetch'))).toBe('Failed to fetch')
    expect(translateError('nope')).toBeNull()
  })
})
