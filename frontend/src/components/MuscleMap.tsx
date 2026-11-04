import { useTranslation } from 'react-i18next'
import { muscleGroupLabel } from '../utils/muscleGroups'
import { MUSCLE_REGIONS } from './muscleRegions'

type RegionState = 'primary' | 'secondary' | 'idle' | 'body'

function stateOf(muscle: string | null, primary: string, secondary: string[]): RegionState {
  if (muscle === null) return 'body'
  if (muscle === primary) return 'primary'
  return secondary.includes(muscle) ? 'secondary' : 'idle'
}

interface MuscleMapProps {
  primary: string
  secondary: string[]
}

/**
 * Front and back body figures with the worked muscle groups highlighted. Primary wins when a group is in both
 * inputs; unknown group strings highlight nothing.
 */
export default function MuscleMap({ primary, secondary }: MuscleMapProps) {
  const { t } = useTranslation()
  const names = [primary, ...secondary.filter((group) => group !== primary)]
    .filter(Boolean)
    .map((group) => muscleGroupLabel(group))
    .join(', ')

  return (
    <div className="muscle-map">
      <div className="muscle-map-figures" role="img" aria-label={t('exercises.musclesLabel', { name: names })}>
        {(['front', 'back'] as const).map((view) => (
          <svg key={view} viewBox="0 0 100 200" aria-hidden="true" focusable="false" data-view={view}>
            {MUSCLE_REGIONS.filter((region) => region.view === view).map((region, index) => (
              <polygon
                key={`${region.muscle ?? 'body'}-${index}`}
                className="muscle-region"
                points={region.points}
                data-muscle={region.muscle ?? undefined}
                data-state={stateOf(region.muscle, primary, secondary)}
              />
            ))}
          </svg>
        ))}
      </div>
      <div className="muscle-legend">
        <span>
          <i className="muscle-swatch--primary" aria-hidden="true" />
          {t('exercises.musclePrimary')}
        </span>
        <span>
          <i className="muscle-swatch--secondary" aria-hidden="true" />
          {t('exercises.muscleSecondary')}
        </span>
      </div>
    </div>
  )
}
