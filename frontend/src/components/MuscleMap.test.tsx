import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { muscleGroupLabel } from '../utils/muscleGroups'
import MuscleMap from './MuscleMap'

describe('MuscleMap', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
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

  it('renders the legend labels synchronously', () => {
    const html = renderToStaticMarkup(<MuscleMap primary="CHEST" secondary={[]} />)
    expect(html).toContain(i18n.t('exercises.musclePrimary'))
    expect(html).toContain(i18n.t('exercises.muscleSecondary'))
  })

  it('shows the placeholder, not the lazy figure, in the initial markup', () => {
    const html = renderToStaticMarkup(<MuscleMap primary="CHEST" secondary={['TRICEPS']} />)
    expect(html).toContain('muscle-figure-placeholder')
    expect(html).not.toContain('data-muscle')
    expect(html).not.toContain('<svg')
  })
})
