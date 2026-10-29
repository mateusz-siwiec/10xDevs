import type { ParseKeys } from 'i18next'
import i18n from '../i18n'
import { ApiError } from '../api/client'

type Options = Record<string, string | number | boolean>

// Keys here are built at runtime, so they cannot satisfy the generated key types.
const translate = i18n.t.bind(i18n) as unknown as (key: string, options?: Options) => unknown

/**
 * Looks up a key built at runtime; returns undefined when the active locales don't define it or
 * the key resolves to something other than a string (e.g. a namespace object like `validation.fields`).
 */
function lookup(key: string, options?: Options): string | undefined {
  if (!i18n.exists(key)) return undefined
  // returnObjects makes a namespace key come back as an object (rejected below) rather than an error string.
  const result = translate(key, { ...options, returnObjects: true })
  return typeof result === 'string' ? result : undefined
}

/** "entries[0].sets" -> "sets"; shown as a translated label when one exists. */
function fieldLabel(field: string | undefined): string {
  if (!field) return ''
  const leaf = field.split('.').pop()?.replace(/\[\d+\]$/, '') ?? field
  return lookup(`validation.fields.${leaf}`) ?? leaf
}

/**
 * Turns a failed API call into user-facing text in the active language. Known error codes and
 * validation rules are translated; an ApiError with an unknown code falls back to the server's
 * English message. Errors that are not ApiErrors (e.g. a network failure) use the page's translated
 * fallback when one is given, else their message. Never throws.
 */
export function translateError(err: unknown, fallbackKey: ParseKeys): string
export function translateError(err: unknown): string | null
export function translateError(err: unknown, fallbackKey?: ParseKeys): string | null {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_FAILED' && err.rule) {
      const text = lookup(`validation.${err.rule}`, {
        field: fieldLabel(err.field),
        min: err.min ?? '',
        max: err.max ?? '',
      })
      if (text) return text
    } else if (err.code) {
      const text = lookup(`errors.${err.code}`, { status: err.status })
      if (text) return text
    }
    if (err.message) return err.message
  }
  if (fallbackKey) return String(translate(fallbackKey))
  if (err instanceof Error) return err.message
  return null
}

/** A failed action kept in state: the raw error is translated at render so it follows language changes. */
export interface ErrorInfo {
  err: unknown
  key: ParseKeys
}
