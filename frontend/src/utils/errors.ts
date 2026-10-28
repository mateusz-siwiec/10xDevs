import type { ParseKeys } from 'i18next'
import i18n from '../i18n'
import { ApiError } from '../api/client'

// Keys here are built at runtime, so they cannot satisfy the generated key types.
const translate = i18n.t.bind(i18n) as unknown as (key: string, options?: Record<string, string>) => string

/** Looks up a key built at runtime; returns undefined when the active locales don't define it. */
function lookup(key: string, options?: Record<string, string>): string | undefined {
  return i18n.exists(key) ? translate(key, options) : undefined
}

/** "entries[0].sets" -> "sets"; shown as a translated label when one exists. */
function fieldLabel(field: string | undefined): string {
  if (!field) return ''
  const leaf = field.split('.').pop()?.replace(/\[\d+\]$/, '') ?? field
  return lookup(`validation.fields.${leaf}`) ?? leaf
}

/**
 * Turns a failed API call into user-facing text in the active language. Known error codes and
 * validation rules are translated; anything else falls back to the server's English message,
 * or to the page's translated fallback when the error carries no message. Never throws.
 */
export function translateError(err: unknown, fallbackKey: ParseKeys): string
export function translateError(err: unknown): string | null
export function translateError(err: unknown, fallbackKey?: ParseKeys): string | null {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_FAILED' && err.rule) {
      const text = lookup(`validation.${err.rule}`, { field: fieldLabel(err.field) })
      if (text) return text
    } else if (err.code) {
      const text = lookup(`errors.${err.code}`)
      if (text) return text
    }
  }
  if (err instanceof Error) return err.message
  return fallbackKey ? translate(fallbackKey) : null
}
