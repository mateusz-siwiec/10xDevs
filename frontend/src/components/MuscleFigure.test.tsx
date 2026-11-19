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

  it('only maps paths to known muscle groups', () => {
    const known = new Set<string>(MUSCLE_GROUPS)
    for (const path of ALL_PATHS) {
      if (path.group !== null) expect(known.has(path.group), path.group).toBe(true)
    }
    // Every drawn body part is a selectable group; nothing is left as plain body any more.
    expect(ALL_PATHS.filter((path) => path.group === null)).toHaveLength(0)
  })

  it('draws front, side and rear delts as separate regions, one path per side in the views that show them', () => {
    const count = (view: 'front' | 'back', group: string) =>
      MUSCLE_FIGURE[view].muscles.filter((path) => path.group === group).length
    expect(count('front', 'FRONT_DELTS')).toBe(2)
    expect(count('back', 'FRONT_DELTS')).toBe(0)
    expect(count('front', 'SIDE_DELTS')).toBe(2)
    expect(count('back', 'SIDE_DELTS')).toBe(2)
    expect(count('front', 'REAR_DELTS')).toBe(0)
    expect(count('back', 'REAR_DELTS')).toBe(2)
    expect(ALL_PATHS.some((path) => path.group === 'SHOULDERS')).toBe(false)
  })

  it('highlights adductors and abductors, one path per side in each view', () => {
    for (const group of ['ADDUCTORS', 'ABDUCTORS']) {
      expect(MUSCLE_FIGURE.front.muscles.filter((path) => path.group === group), `${group} front`).toHaveLength(2)
      expect(MUSCLE_FIGURE.back.muscles.filter((path) => path.group === group), `${group} back`).toHaveLength(2)
    }
    const result = states('ADDUCTORS', ['ABDUCTORS'])
    expect([...result.get('ADDUCTORS')!]).toEqual(['primary'])
    expect([...result.get('ABDUCTORS')!]).toEqual(['secondary'])
    expect([...states('REAR_DELTS', ['SIDE_DELTS']).get('FRONT_DELTS')!]).toEqual(['idle'])
  })

  it('draws the body outline before the muscle paths in each view', () => {
    const html = render('MID_CHEST', [])
    for (const view of ['front', 'back']) {
      expect(html).toMatch(new RegExp(`<svg[^>]*data-view="${view}"[^>]*><path class="muscle-body"`))
    }
  })

  it('marks primary, secondary and idle regions', () => {
    const result = states('MID_CHEST', ['TRICEPS', 'BICEPS'])
    expect([...result.get('MID_CHEST')!]).toEqual(['primary'])
    expect([...result.get('TRICEPS')!]).toEqual(['secondary'])
    expect([...result.get('BICEPS')!]).toEqual(['secondary'])
    expect([...result.get('QUADS')!]).toEqual(['idle'])
    expect([...result.get('LATS')!]).toEqual(['idle'])
  })

  it('splits the chest into upper, mid and lower regions, two paths each in the front view only', () => {
    const count = (view: 'front' | 'back', group: string) =>
      MUSCLE_FIGURE[view].muscles.filter((path) => path.group === group).length
    for (const group of ['UPPER_CHEST', 'MID_CHEST', 'LOWER_CHEST']) {
      expect(count('front', group), `${group} front`).toBe(2)
      expect(count('back', group), `${group} back`).toBe(0)
    }
    expect(ALL_PATHS.some((path) => path.group === 'CHEST')).toBe(false)
  })

  it('highlights only the chest regions that are worked', () => {
    const result = states('UPPER_CHEST', ['LOWER_CHEST'])
    expect([...result.get('UPPER_CHEST')!]).toEqual(['primary'])
    expect([...result.get('LOWER_CHEST')!]).toEqual(['secondary'])
    expect([...result.get('MID_CHEST')!]).toEqual(['idle'])
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

  it('ignores unknown groups without highlighting anything', () => {
    const result = states('NOPE', ['ALSO_NOPE'])
    for (const set of result.values()) expect([...set]).toEqual(['idle'])
  })
})
