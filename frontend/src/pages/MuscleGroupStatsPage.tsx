import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getMuscleGroupStats } from '../api/client'
import type { MuscleGroupStats, StatsWindow } from '../api/client'
import { MUSCLE_PARENTS, muscleGroupLabel, muscleParentLabel } from '../utils/muscleGroups'
import type { MuscleParentKey } from '../utils/muscleGroups'
import '../styles/page.css'
import '../styles/dashboard.css'
import '../styles/muscle-groups.css'
import { translateError } from '../utils/errors'

interface FetchResult {
  days: StatsWindow
  includeSecondary: boolean
  stats: MuscleGroupStats | null
  error: unknown
}

const WINDOW_OPTIONS: { value: StatsWindow; label: string | null }[] = [
  { value: 7, label: '7' },
  { value: 30, label: '30' },
  { value: 90, label: '90' },
  { value: 'all', label: null },
]

export default function MuscleGroupStatsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState<StatsWindow>(30)
  const [includeSecondary, setIncludeSecondary] = useState(false)
  const [result, setResult] = useState<FetchResult | null>(null)
  // Expanded parent rows; kept when the time window changes, not persisted across visits.
  const [expanded, setExpanded] = useState<ReadonlySet<MuscleParentKey>>(new Set())

  function toggle(key: MuscleParentKey) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  useEffect(() => {
    let cancelled = false
    getMuscleGroupStats(days, includeSecondary)
      .then((stats) => {
        if (!cancelled) setResult({ days, includeSecondary, stats, error: null })
      })
      .catch((err) => {
        if (!cancelled) setResult({ days, includeSecondary, stats: null, error: err })
      })
    return () => {
      cancelled = true
    }
  }, [days, includeSecondary])

  const shown =
    result !== null && result.days === days && result.includeSecondary === includeSecondary ? result : null

  // `status` (loading / error / empty / total) is the polite live region; the expandable list stays outside it so
  // toggling a parent does not make assistive technology re-announce the whole list.
  let status
  let body = null
  if (shown === null) {
    status = <p className="page-subtext">{t('muscleStats.loading')}</p>
  } else if (shown.error || shown.stats === null) {
    status = (
      <p className="error-text" role="alert">
        {translateError(shown.error, 'muscleStats.loadFailed')}
      </p>
    )
  } else if (shown.stats.totalSets === 0) {
    status = (
      <p className="page-subtext">
        {days === 'all' ? t('muscleStats.emptyAll') : t('muscleStats.emptyWindow', { days })}{' '}
        {t('muscleStats.startHint')}
      </p>
    )
  } else {
    const { groups, totalSets, parents: parentStats } = shown.stats
    const setsByGroup = new Map(groups.map((group) => [group.muscleGroup as string, group.sets]))
    const failureByGroup = new Map(groups.map((group) => [group.muscleGroup as string, group.failureSets]))
    // Most-trained first; Array.sort is stable, so ties keep the hierarchy order.
    const setsByParent = new Map(parentStats.map((parent) => [parent.parent, parent.sets]))
    const failureByParent = new Map(parentStats.map((parent) => [parent.parent, parent.failureSets]))
    const parents = MUSCLE_PARENTS.map((parent) => {
      const children = parent.groups
        .map((group) => ({ group, sets: setsByGroup.get(group) ?? 0, failureSets: failureByGroup.get(group) ?? 0 }))
        .sort((a, b) => b.sets - a.sets)
      return {
        key: parent.key,
        children,
        sets: setsByParent.get(parent.key) ?? 0,
        failureSets: failureByParent.get(parent.key) ?? 0,
      }
    }).sort((a, b) => b.sets - a.sets)
    const max = parents[0].sets
    status = <p className="muscle-total">{t('muscleStats.total', { count: totalSets })}</p>
    body = (
      <>
        <ul className="muscle-list">
          {parents.map((parent) => {
            const open = expanded.has(parent.key)
            const listId = `muscle-children-${parent.key}`
            return (
              <li key={parent.key} className="muscle-parent" data-parent={parent.key}>
                <div className="muscle-row">
                  {parent.children.length > 1 ? (
                    <button
                      type="button"
                      className="muscle-toggle"
                      aria-expanded={open}
                      aria-controls={listId}
                      onClick={() => toggle(parent.key)}
                    >
                      <svg
                        className="muscle-chevron"
                        viewBox="0 0 12 12"
                        width="12"
                        height="12"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      {muscleParentLabel(parent.key)}
                    </button>
                  ) : (
                    <span className="muscle-name">{muscleParentLabel(parent.key)}</span>
                  )}
                  <span
                    className="muscle-bar"
                    role="img"
                    aria-label={t('muscleStats.setsCount', { count: parent.sets })}
                  >
                    <span className="muscle-bar-fill" style={{ width: `${max > 0 ? (parent.sets / max) * 100 : 0}%` }} />
                  </span>
                  <span className="muscle-count">{parent.sets}</span>
                  {parent.failureSets > 0 && (
                    <span className="muscle-failure">{t('muscleStats.failureCount', { count: parent.failureSets })}</span>
                  )}
                </div>
                {parent.children.length > 1 && (
                  <ul id={listId} className="muscle-children" hidden={!open}>
                    {parent.children.map((child) => (
                      <li key={child.group} className="muscle-row" data-group={child.group}>
                        <span className="muscle-name">{muscleGroupLabel(child.group)}</span>
                        <span
                          className="muscle-bar"
                          role="img"
                          aria-label={t('muscleStats.setsCount', { count: child.sets })}
                        >
                          <span
                            className="muscle-bar-fill"
                            style={{ width: `${parent.sets === 0 ? 0 : Math.min(100, (child.sets / parent.sets) * 100)}%` }}
                          />
                        </span>
                        <span className="muscle-count">{child.sets}</span>
                        {child.failureSets > 0 && (
                          <span className="muscle-failure">
                            {t('muscleStats.failureCount', { count: child.failureSets })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        <p className="page-subtext">{t(includeSecondary ? 'muscleStats.noteSecondary' : 'muscleStats.note')}</p>
      </>
    )
  }

  return (
    <div className="page-shell">
      <main className="page-card dashboard-card">
        <Link to="/" className="history-back">
          {t('muscleStats.back')}
        </Link>
        <h1>{t('muscleStats.title')}</h1>
        <div className="dashboard-toggle" role="group" aria-label={t('dashboard.windowLabel')}>
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="btn-secondary"
              aria-pressed={days === option.value}
              onClick={() => setDays(option.value)}
            >
              {option.label ?? t('dashboard.windowAll')}
            </button>
          ))}
        </div>
        <label className="muscle-secondary-toggle">
          <input
            type="checkbox"
            checked={includeSecondary}
            onChange={(event) => setIncludeSecondary(event.target.checked)}
          />
          {t('muscleStats.includeSecondary')}
        </label>
        <div aria-live="polite">{status}</div>
        {body}
      </main>
    </div>
  )
}
