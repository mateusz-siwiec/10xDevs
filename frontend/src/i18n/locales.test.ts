import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import pl from './locales/pl.json'

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === 'object'
      ? flatten(value as Record<string, unknown>, path)
      : [path]
  })
}

function baseKeys(keys: string[]): Set<string> {
  return new Set(keys.map((k) => k.replace(PLURAL_SUFFIX, '')))
}

function pluralBases(keys: string[]): Set<string> {
  return new Set(keys.filter((k) => PLURAL_SUFFIX.test(k)).map((k) => k.replace(PLURAL_SUFFIX, '')))
}

describe('locale parity', () => {
  const enKeys = flatten(en)
  const plKeys = flatten(pl)

  it('has the same keys in en and pl (ignoring plural suffixes)', () => {
    const enBase = baseKeys(enKeys)
    const plBase = baseKeys(plKeys)
    expect([...enBase].filter((k) => !plBase.has(k)).sort()).toEqual([])
    expect([...plBase].filter((k) => !enBase.has(k)).sort()).toEqual([])
  })

  it('defines every plural category for keys with plural forms', () => {
    const bases = new Set([...pluralBases(enKeys), ...pluralBases(plKeys)])
    const langs = [
      { lang: 'en', keys: new Set(enKeys) },
      { lang: 'pl', keys: new Set(plKeys) },
    ]
    const missing: string[] = []
    for (const { lang, keys } of langs) {
      const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories
      for (const base of bases) {
        for (const category of categories) {
          if (!keys.has(`${base}_${category}`)) missing.push(`${lang}: ${base}_${category}`)
        }
      }
    }
    expect(missing.sort()).toEqual([])
  })
})
