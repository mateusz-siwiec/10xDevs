import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ApiError, createExercise, getExercises, updateExercise } from '../api/client'
import type { Measure, WeightMode } from '../api/client'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/plans.css'
import '../styles/exercises.css'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'
import { MUSCLE_GROUPS, muscleGroupLabel } from '../utils/muscleGroups'

const NAME_MAX_LENGTH = 60
const WEIGHT_MODES: { mode: WeightMode; labelKey: 'exercises.weightModeRequired' | 'exercises.weightModeOptional' | 'exercises.weightModeNone' }[] = [
  { mode: 'REQUIRED', labelKey: 'exercises.weightModeRequired' },
  { mode: 'OPTIONAL', labelKey: 'exercises.weightModeOptional' },
  { mode: 'NONE', labelKey: 'exercises.weightModeNone' },
]

const MEASURES: { measure: Measure; labelKey: 'exercises.measureReps' | 'exercises.measureDuration' }[] = [
  { measure: 'REPS', labelKey: 'exercises.measureReps' },
  { measure: 'DURATION', labelKey: 'exercises.measureDuration' },
]

/**
 * /exercises/new and /exercises/:id/edit render this same component at the same place in the tree, so React would
 * keep the previous form's state when navigating between them. Keying the form by the route starts each one fresh.
 */
export default function ExerciseFormPage() {
  const { id } = useParams()
  return <ExerciseForm key={id ?? 'new'} editingId={id ?? null} />
}

function ExerciseForm({ editingId }: { editingId: string | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(editingId !== null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState('')
  const [secondary, setSecondary] = useState<string[]>([])
  const [weightMode, setWeightMode] = useState<WeightMode>('REQUIRED')
  const [measure, setMeasure] = useState<Measure>('REPS')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingId === null) return
    let cancelled = false
    getExercises()
      .then((list) => {
        if (cancelled) return
        const found = list.find((e) => e.id === editingId)
        if (!found || !found.custom) {
          setNotFound(true)
          return
        }
        setName(found.name)
        setPrimary(found.primaryMuscleGroup)
        setSecondary(found.secondaryMuscleGroups)
        setWeightMode(found.weightMode)
        setMeasure(found.measure)
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
  }, [editingId])

  function handlePrimaryChange(group: string) {
    setPrimary(group)
    setSecondary((list) => list.filter((g) => g !== group))
  }

  function toggleSecondary(group: string) {
    setSecondary((list) =>
      list.includes(group) ? list.filter((g) => g !== group) : [...list, group],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    const payload = {
      name: name.trim(),
      primaryMuscleGroup: primary,
      secondaryMuscleGroups: secondary,
      weightMode,
      measure,
    }
    try {
      if (editingId) {
        await updateExercise(editingId, payload)
      } else {
        await createExercise(payload)
      }
      navigate('/exercises')
    } catch (err) {
      // The generic EXERCISE_IN_USE text talks about deleting; here it means the weight and measure settings are locked.
      if (editingId && err instanceof ApiError && err.code === 'EXERCISE_IN_USE') {
        setError({ err: null, key: 'exercises.settingsInUse' })
      } else {
        setError({ err, key: editingId ? 'exercises.updateFailed' : 'exercises.addFailed' })
      }
      setSaving(false)
    }
  }

  const canSave = !saving && name.trim() !== '' && primary !== ''
  const heading = editingId ? t('exercises.editing') : t('exercises.add')

  return (
    <div className="page-shell">
      <main className="page-card plans-card">
        <h1>{heading}</h1>
        {loading ? (
          <p className="page-subtext">{t('exercises.loading')}</p>
        ) : notFound ? (
          <>
            <p className="page-subtext">{t('exercises.notFound')}</p>
            <Link to="/exercises">{t('exercises.backToList')}</Link>
          </>
        ) : loadFailed ? (
          <>
            {error && (
              <p role="alert" className="error-text">
                {translateError(error.err, error.key)}
              </p>
            )}
            <Link to="/exercises">{t('exercises.backToList')}</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="exercise-name">{t('exercises.name')}</label>
              <input
                id="exercise-name"
                type="text"
                maxLength={NAME_MAX_LENGTH}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="exercise-primary">{t('exercises.primaryGroup')}</label>
              <select
                id="exercise-primary"
                className="workout-select"
                value={primary}
                onChange={(event) => handlePrimaryChange(event.target.value)}
              >
                <option value="" disabled>
                  {t('exercises.choosePrimary')}
                </option>
                {MUSCLE_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {muscleGroupLabel(group)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="exercise-weight-mode">{t('exercises.weightMode')}</label>
              <select
                id="exercise-weight-mode"
                className="workout-select"
                value={weightMode}
                disabled={saving}
                onChange={(event) => setWeightMode(event.target.value as WeightMode)}
              >
                {WEIGHT_MODES.map(({ mode, labelKey }) => (
                  <option key={mode} value={mode}>
                    {t(labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="exercise-measure">{t('exercises.measure')}</label>
              <select
                id="exercise-measure"
                className="workout-select"
                value={measure}
                disabled={saving}
                onChange={(event) => setMeasure(event.target.value as Measure)}
              >
                {MEASURES.map(({ measure: value, labelKey }) => (
                  <option key={value} value={value}>
                    {t(labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="exercise-secondary">
              <legend>{t('exercises.secondaryGroups')}</legend>
              <div className="exercise-secondary-options">
                {MUSCLE_GROUPS.filter((group) => group !== primary).map((group) => (
                  <label key={group} className="exercise-secondary-option">
                    <input
                      type="checkbox"
                      checked={secondary.includes(group)}
                      onChange={() => toggleSecondary(group)}
                    />
                    {muscleGroupLabel(group)}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="error-text">
                {translateError(error.err, error.key)}
              </p>
            )}
            <div className="plan-item-actions">
              <button type="submit" className="btn-primary" disabled={!canSave}>
                {editingId
                  ? saving
                    ? t('common.saving')
                    : t('common.save')
                  : saving
                    ? t('exercises.adding')
                    : t('exercises.add')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => navigate('/exercises')}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
