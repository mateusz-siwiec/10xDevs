import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { MUSCLE_GROUPS, muscleGroupLabel } from '../utils/muscleGroups'
import MuscleMap from './MuscleMap'
import { MUSCLE_REGIONS } from './muscleRegions'

function states(primary: string, secondary: string[]): Map<string, Set<string>> {
  const html = renderToStaticMarkup(<MuscleMap primary={primary} secondary={secondary} />)
  const result = new Map<string, Set<string>>()
  for (const match of html.matchAll(/<polygon[^>]*?data-muscle="([^"]+)" data-state="([^"]+)"/g)) {
    if (!result.has(match[1])) result.set(match[1], new Set())
    result.get(match[1])!.add(match[2])
  }
  return result
}

describe('MuscleMap', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('has at least one region for every muscle group', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(MUSCLE_REGIONS.some((region) => region.muscle === group), group).toBe(true)
    }
  })

  it('marks primary, secondary and idle regions', () => {
    const result = states('CHEST', ['TRICEPS', 'SHOULDERS'])
    expect([...result.get('CHEST')!]).toEqual(['primary'])
    expect([...result.get('TRICEPS')!]).toEqual(['secondary'])
    expect([...result.get('SHOULDERS')!]).toEqual(['secondary'])
    expect([...result.get('QUADS')!]).toEqual(['idle'])
    expect([...result.get('LATS')!]).toEqual(['idle'])
  })

  it('renders primary when a group is in both inputs', () => {
    const result = states('LATS', ['LATS', 'BICEPS'])
    expect([...result.get('LATS')!]).toEqual(['primary'])
  })

  it('highlights a group drawn in both views in both', () => {
    const html = renderToStaticMarkup(<MuscleMap primary="CALVES" secondary={[]} />)
    const primaryCount = html.match(/data-muscle="CALVES" data-state="primary"/g)!.length
    const calves = MUSCLE_REGIONS.filter((r) => r.muscle === 'CALVES')
    expect(new Set(calves.map((r) => r.view))).toEqual(new Set(['front', 'back']))
    expect(primaryCount).toBe(calves.length)
  })

  it('draws plain body parts that are never highlighted', () => {
    const html = renderToStaticMarkup(<MuscleMap primary="CHEST" secondary={[]} />)
    const bodyParts = MUSCLE_REGIONS.filter((r) => r.muscle === null).length
    expect(bodyParts).toBeGreaterThan(0)
    expect(html.match(/data-state="body"/g)!.length).toBe(bodyParts)
    expect(html).not.toMatch(/data-muscle="[^"]*" data-state="body"/)
  })

  it('ignores unknown groups without highlighting anything', () => {
    const result = states('NOPE', ['ALSO_NOPE'])
    for (const set of result.values()) expect([...set]).toEqual(['idle'])
  })

  it('names the worked muscles in the active language', async () => {
    await i18n.changeLanguage('en')
    let html = renderToStaticMarkup(<MuscleMap primary="CHEST" secondary={['TRICEPS']} />)
    expect(html).toContain(`Muscles worked: ${muscleGroupLabel('CHEST')}, ${muscleGroupLabel('TRICEPS')}`)

    await i18n.changeLanguage('pl')
    html = renderToStaticMarkup(<MuscleMap primary="CHEST" secondary={['TRICEPS']} />)
    expect(html).toContain(`Mięśnie: ${muscleGroupLabel('CHEST')}, ${muscleGroupLabel('TRICEPS')}`)
    expect(muscleGroupLabel('CHEST')).not.toBe('CHEST')
  })
})
