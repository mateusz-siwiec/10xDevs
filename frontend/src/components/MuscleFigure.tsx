import { MUSCLE_FIGURE, MUSCLE_FIGURE_VIEW_BOX } from './muscleFigureData'

type RegionState = 'primary' | 'secondary' | 'idle' | 'body'

function stateOf(muscle: string | null, primary: string, secondary: string[]): RegionState {
  if (muscle === null) return 'body'
  if (muscle === primary) return 'primary'
  return secondary.includes(muscle) ? 'secondary' : 'idle'
}

interface MuscleFigureProps {
  primary: string
  secondary: string[]
}

/**
 * Front and back body figures with the worked muscle groups highlighted. Primary wins when a group is in both
 * inputs; unknown group strings highlight nothing. Pure and synchronous (MuscleMap loads it lazily).
 */
export default function MuscleFigure({ primary, secondary }: MuscleFigureProps) {
  return (
    <>
      {(['front', 'back'] as const).map((view) => (
        <svg key={view} viewBox={MUSCLE_FIGURE_VIEW_BOX} aria-hidden="true" focusable="false" data-view={view}>
          <path className="muscle-body" d={MUSCLE_FIGURE[view].body} />
          {MUSCLE_FIGURE[view].muscles.map((region, index) => (
            <path
              key={`${region.group ?? 'body'}-${index}`}
              className="muscle-region"
              d={region.d}
              data-muscle={region.group ?? undefined}
              data-state={stateOf(region.group, primary, secondary)}
            />
          ))}
        </svg>
      ))}
    </>
  )
}
