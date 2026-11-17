import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The shipped figure no longer has plain-body regions, so the `null` group branch is covered with fixture data.
vi.mock('./muscleFigureData', () => ({
  MUSCLE_FIGURE_VIEW_BOX: '0 0 10 10',
  MUSCLE_FIGURE: {
    front: {
      body: 'M0 0L1 1Z',
      muscles: [
        { group: 'CHEST', d: 'M0 0L1 1Z' },
        { group: null, d: 'M2 2L3 3Z' },
      ],
    },
    back: { body: 'M0 0L1 1Z', muscles: [{ group: null, d: 'M4 4L5 5Z' }] },
  },
}))

import MuscleFigure from './MuscleFigure'

describe('MuscleFigure plain body parts', () => {
  it('draws regions without a group as plain body that is never highlighted', () => {
    const html = renderToStaticMarkup(<MuscleFigure primary="CHEST" secondary={[]} />)
    expect(html.match(/data-state="body"/g)!.length).toBe(2)
    expect(html).not.toMatch(/data-muscle="[^"]*" data-state="body"/)
  })
})
