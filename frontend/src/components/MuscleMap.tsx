import { Component, lazy, Suspense, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { muscleGroupLabel } from '../utils/muscleGroups'

const MuscleFigure = lazy(() => import('./MuscleFigure'))

/** Same footprint as the loaded figures (two blocks), so the tooltip does not jump when the chunk arrives. */
function MuscleFigurePlaceholder() {
  return (
    <>
      <div className="muscle-figure-placeholder skeleton" data-testid="muscle-figure-placeholder" />
      <div className="muscle-figure-placeholder skeleton" />
    </>
  )
}

/** Renders no figures when the lazy chunk fails to load; the aria-label and legend still work. */
class FigureErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

interface MuscleMapProps {
  primary: string
  secondary: string[]
}

/**
 * Front and back body figures with the worked muscle groups highlighted. Primary wins when a group is in both
 * inputs; unknown group strings highlight nothing. The figure is loaded lazily; label and legend are synchronous.
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
        <FigureErrorBoundary>
          <Suspense fallback={<MuscleFigurePlaceholder />}>
            <MuscleFigure primary={primary} secondary={secondary} />
          </Suspense>
        </FigureErrorBoundary>
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
