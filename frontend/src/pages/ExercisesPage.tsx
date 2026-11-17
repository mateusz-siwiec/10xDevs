import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { deleteExercise, getExercises, setExerciseFavorite } from '../api/client'
import type { Exercise } from '../api/client'
import TechniqueTooltip from '../components/TechniqueTooltip'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/plans.css'
import '../styles/exercises.css'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'
import { exerciseName, matchesExerciseSearch, sortExercisesByName } from '../utils/exercises'
import { MUSCLE_GROUPS, muscleGroupLabel } from '../utils/muscleGroups'

type MuscleFilter = (typeof MUSCLE_GROUPS)[number]
interface Filters {
  scope: 'all' | 'mine' | 'favorites'
  muscle: '' | MuscleFilter
  search: string
}

const DEFAULT_FILTERS: Filters = { scope: 'all', muscle: '', search: '' }

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
    </svg>
  )
}

export default function ExercisesPage() {
  const { t } = useTranslation()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Rows whose favourite toggle request is still running; their star is disabled meanwhile.
  const [favoriteBusy, setFavoriteBusy] = useState<ReadonlySet<string>>(new Set())
  const favoriteInFlight = useRef(new Set<string>())
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Where focus goes once the confirm buttons (or the deleted/un-starred row) have unmounted.
  const pendingFocus = useRef<
    { kind: 'row'; id: string } | { kind: 'star'; id: string } | { kind: 'heading' } | null
  >(null)

  useEffect(() => {
    let cancelled = false
    getExercises()
      .then((list) => {
        if (!cancelled) setExercises(list)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadFailed(true)
        setError({ err, key: 'exercises.loadFailed' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Without this focus would fall to <body> when the focused button unmounts.
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    if (target.kind === 'row') document.getElementById(`delete-${target.id}`)?.focus()
    else if (target.kind === 'star') document.getElementById(`favorite-${target.id}`)?.focus()
    else headingRef.current?.focus()
  }, [confirmingId, exercises])

  function patchFavorite(id: string, favorite: boolean) {
    setExercises((list) => list.map((e) => (e.id === id ? { ...e, favorite } : e)))
  }

  async function toggleFavorite(exercise: Exercise) {
    const { id } = exercise
    // `disabled` only applies after the next render, so a same-tick second click needs this guard.
    if (favoriteInFlight.current.has(id)) return
    favoriteInFlight.current.add(id)
    const favorite = !exercise.favorite
    // Un-starring inside the Favourites scope removes the row under the user's focus.
    const removesRow = !favorite && filters.scope === 'favorites'
    setError(null)
    setFavoriteBusy((ids) => new Set(ids).add(id))
    if (removesRow) pendingFocus.current = { kind: 'heading' }
    patchFavorite(id, favorite)
    try {
      await setExerciseFavorite(id, favorite)
    } catch (err) {
      if (removesRow) pendingFocus.current = { kind: 'star', id }
      patchFavorite(id, !favorite)
      setError({ err, key: 'exercises.favoriteFailed' })
    } finally {
      favoriteInFlight.current.delete(id)
      setFavoriteBusy((ids) => {
        const next = new Set(ids)
        next.delete(id)
        return next
      })
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    setBusy(true)
    try {
      await deleteExercise(id)
      pendingFocus.current = { kind: 'heading' }
      setExercises((list) => list.filter((e) => e.id !== id))
    } catch (err) {
      pendingFocus.current = { kind: 'row', id }
      setError({ err, key: 'exercises.deleteFailed' })
    } finally {
      setBusy(false)
      // Only close this row's confirmation: another row may have opened its own while the request ran.
      setConfirmingId((current) => (current === id ? null : current))
    }
  }

  function cancelDelete(id: string) {
    pendingFocus.current = { kind: 'row', id }
    setConfirmingId(null)
  }

  const visible = sortExercisesByName(
    exercises.filter(
      (e) =>
        (filters.scope === 'all' ||
          (filters.scope === 'mine' ? e.custom : e.favorite)) &&
        (filters.muscle === '' ||
          e.primaryMuscleGroup === filters.muscle ||
          e.secondaryMuscleGroups.includes(filters.muscle)) &&
        matchesExerciseSearch(e, filters.search),
    ),
  )
  const filtersActive =
    filters.scope !== DEFAULT_FILTERS.scope ||
    filters.muscle !== '' ||
    filters.search.trim() !== ''
  const noFavoritesYet = filters.scope === 'favorites' && !exercises.some((e) => e.favorite)

  return (
    <div className="page-shell">
      <main className="page-card plans-card">
        <h1 ref={headingRef} tabIndex={-1}>
          {t('exercises.title')}
        </h1>
        <div className="dashboard-toggle" role="group" aria-label={t('exercises.scopeLabel')}>
          {(['all', 'mine', 'favorites'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              className="btn-secondary"
              aria-pressed={filters.scope === scope}
              onClick={() => setFilters((f) => ({ ...f, scope }))}
            >
              {scope === 'all'
                ? t('exercises.scopeAll')
                : scope === 'mine'
                  ? t('exercises.scopeMine')
                  : t('exercises.scopeFavorites')}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="exercise-search">{t('exercises.searchLabel')}</label>
          <input
            id="exercise-search"
            type="search"
            value={filters.search}
            placeholder={t('exercises.searchPlaceholder')}
            autoComplete="off"
            onChange={(event) => setFilters((f) => ({ ...f, search: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="exercise-muscle-filter">{t('exercises.muscleFilter')}</label>
          <select
            id="exercise-muscle-filter"
            className="workout-select"
            value={filters.muscle}
            onChange={(event) =>
              setFilters((f) => ({ ...f, muscle: event.target.value as Filters['muscle'] }))
            }
          >
            <option value="">{t('exercises.allMuscles')}</option>
            {MUSCLE_GROUPS.map((group) => (
              <option key={group} value={group}>
                {muscleGroupLabel(group)}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="error-text">
            {translateError(error.err, error.key)}
          </p>
        )}
        <p className="visually-hidden" aria-live="polite">
          {loading || loadFailed ? '' : t('exercises.resultCount', { count: visible.length })}
        </p>
        <section className="workout-section">
          {loading ? (
            <p className="page-subtext">{t('exercises.loading')}</p>
          ) : loadFailed ? null : exercises.length === 0 ? (
            <p className="page-subtext">{t('exercises.empty')}</p>
          ) : visible.length === 0 ? (
            <>
              <p className="page-subtext">
                {noFavoritesYet ? t('exercises.noFavorites') : t('exercises.noMatches')}
              </p>
              {filtersActive && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  {t('exercises.clearFilters')}
                </button>
              )}
            </>
          ) : (
            <ul className="plan-list exercise-list">
              {visible.map((exercise) => (
                <li key={exercise.id} className="plan-item">
                  <div className="plan-item-info">
                    <span className="plan-item-name">
                      {exerciseName(exercise)}
                      {exercise.custom && <span className="badge">{t('exercises.custom')}</span>}
                      <TechniqueTooltip exercise={exercise} />
                    </span>
                    <span>
                      {muscleGroupLabel(exercise.primaryMuscleGroup)}
                      {exercise.secondaryMuscleGroups.length > 0 &&
                        ` · ${exercise.secondaryMuscleGroups.map(muscleGroupLabel).join(', ')}`}
                    </span>
                  </div>
                  {exercise.custom && confirmingId === exercise.id ? (
                    <div className="plan-item-actions">
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={busy}
                        onClick={() => handleDelete(exercise.id)}
                      >
                        {t('common.confirm')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => cancelDelete(exercise.id)}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="plan-item-actions">
                      <button
                        type="button"
                        id={`favorite-${exercise.id}`}
                        className="btn-secondary favorite-toggle"
                        aria-pressed={exercise.favorite}
                        aria-label={t('exercises.favoriteLabel', { name: exerciseName(exercise) })}
                        disabled={favoriteBusy.has(exercise.id)}
                        onClick={() => toggleFavorite(exercise)}
                      >
                        <StarIcon filled={exercise.favorite} />
                      </button>
                      {exercise.custom && (
                        <>
                          <Link
                            to={`/exercises/${exercise.id}/edit`}
                            className="btn-secondary"
                            aria-label={t('exercises.editLabel', { name: exerciseName(exercise) })}
                          >
                            {t('common.edit')}
                          </Link>
                          <button
                            type="button"
                            id={`delete-${exercise.id}`}
                            className="btn-secondary"
                            aria-label={t('exercises.deleteLabel', { name: exerciseName(exercise) })}
                            disabled={busy}
                            onClick={() => {
                              setError(null)
                              setConfirmingId(exercise.id)
                            }}
                          >
                            {t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
