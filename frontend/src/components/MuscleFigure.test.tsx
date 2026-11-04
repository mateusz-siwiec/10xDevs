import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS } from '../utils/muscleGroups'
import MuscleFigure from './MuscleFigure'
import { MUSCLE_FIGURE } from './muscleFigureData'

const ALL_PATHS = [...MUSCLE_FIGURE.front.muscles, ...MUSCLE_FIGURE.back.muscles]

function render(primary: string, secondary: string[]): string {
  return renderToStaticMarkup(<MuscleFigure primary={primary} secondary={secondary} />)
}

function states(primary: string, secondary: string[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  for (const match of render(primary, secondary).matchAll(/<path[^>]*?data-muscle="([^"]+)" data-state="([^"]+)"/g)) {
    if (!result.has(match[1])) result.set(match[1], new Set())
    result.get(match[1])!.add(match[2])
  }
  return result
}

describe('MuscleFigure', () => {
  it('has at least one path for every muscle group', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(
        ALL_PATHS.some((path) => path.group === group),
        group,
      ).toBe(true)
    }
  })

  it('only maps paths to known muscle groups, or to plain body for abductors and adductors', () => {
    const known = new Set<string>(MUSCLE_GROUPS)
    for (const path of ALL_PATHS) {
      if (path.group !== null) expect(known.has(path.group), path.group).toBe(true)
    }
    // Source: ABDUCTORS and ADDUCTORS, one path per side in each of the two views.
    expect(ALL_PATHS.filter((path) => path.group === null)).toHaveLength(8)
  })

  it('draws the body outline before the muscle paths in each view', () => {
    const html = render('CHEST', [])
    for (const view of ['front', 'back']) {
      expect(html).toMatch(new RegExp(`<svg[^>]*data-view="${view}"[^>]*><path class="muscle-body"`))
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
    const html = render('CALVES', [])
    const front = MUSCLE_FIGURE.front.muscles.filter((path) => path.group === 'CALVES').length
    const back = MUSCLE_FIGURE.back.muscles.filter((path) => path.group === 'CALVES').length
    expect(front).toBeGreaterThan(0)
    expect(back).toBeGreaterThan(0)
    expect(html.match(/data-muscle="CALVES" data-state="primary"/g)!.length).toBe(front + back)
  })

  it('draws plain body parts that are never highlighted', () => {
    const html = render('CHEST', [])
    const bodyParts = ALL_PATHS.filter((path) => path.group === null).length
    expect(bodyParts).toBeGreaterThan(0)
    expect(html.match(/data-state="body"/g)!.length).toBe(bodyParts)
    expect(html).not.toMatch(/data-muscle="[^"]*" data-state="body"/)
  })

  it('ignores unknown groups without highlighting anything', () => {
    const result = states('NOPE', ['ALSO_NOPE'])
    for (const set of result.values()) expect([...set]).toEqual(['idle'])
  })
})
