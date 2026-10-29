import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

describe('seeded exercise names', () => {
  const dir = resolve(__dirname, '../../../src/main/resources/db/migration')
  const seededSlugs = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .flatMap((file) => {
      const sql = readFileSync(resolve(dir, file), 'utf8')
      return [...sql.matchAll(/insert\s+into\s+exercises\b[^;]*;/gi)].flatMap((statement) =>
        [...statement[0].matchAll(/\(\s*'([^']+)'\s*,\s*'/g)].map((row) => row[1]),
      )
    })

  it('finds the seeded slugs in the migrations', () => {
    expect(seededSlugs.length).toBeGreaterThanOrEqual(40)
  })

  it.each([
    ['en', en],
    ['pl', pl],
  ])('has an exercises.<slug> entry in %s for every seeded slug', (_lang, resource) => {
    const names = resource.exercises as Record<string, unknown>
    expect(seededSlugs.filter((slug) => typeof names[slug] !== 'string')).toEqual([])
  })
})

describe('backend error codes', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../src/main/java/com/example/gymtrack/common/ErrorCode.java'),
    'utf8',
  )
  const body = source.slice(source.indexOf('{', source.indexOf('enum ErrorCode')) + 1)
  const codes = [...body.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*[,;]?\s*$/gm)].map((match) => match[1])

  it('finds the enum constants', () => {
    expect(codes.length).toBeGreaterThanOrEqual(19)
  })

  it.each([
    ['en', en],
    ['pl', pl],
  ])('has an errors.<CODE> entry in %s for every ErrorCode', (_lang, resource) => {
    const errors = resource.errors as Record<string, unknown>
    expect(codes.filter((code) => typeof errors[code] !== 'string')).toEqual([])
  })

  it.each([
    ['en', en],
    ['pl', pl],
  ])('has a validation.<rule> entry in %s for every rule the backend emits', (_lang, resource) => {
    const validation = resource.validation as Record<string, unknown>
    const rules = ['NotBlank', 'NotNull', 'Email', 'Size', 'Min', 'Max', 'DecimalMin', 'DecimalMax', 'AssertTrue', 'HalfKgStep']
    expect(rules.filter((rule) => typeof validation[rule] !== 'string')).toEqual([])
  })
})
