import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createExercise, deleteExercise, getExercises } from '../api/client'
import type { Exercise } from '../api/client'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/plans.css'
import '../styles/exercises.css'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'
import { exerciseName, sortExercisesByName } from '../utils/exercises'
import { MUSCLE_GROUPS, muscleGroupLabel } from '../utils/muscleGroups'

const NAME_MAX_LENGTH = 60

export default function MyExercisesPage() {
  const { t } = useTranslation()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState('')
  const [secondary, setSecondary] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getExercises()
      .then((list) => {
        if (!cancelled) setExercises(list.filter((e) => e.custom))
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
    try {
      const created = await createExercise({
        name: name.trim(),
        primaryMuscleGroup: primary,
        secondaryMuscleGroups: secondary,
      })
      setExercises((list) => [...list, created])
      setName('')
      setPrimary('')
      setSecondary([])
    } catch (err) {
      setError({ err, key: 'exercises.addFailed' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    setBusy(true)
    try {
      await deleteExercise(id)
      setExercises((list) => list.filter((e) => e.id !== id))
    } catch (err) {
      setError({ err, key: 'exercises.deleteFailed' })
    } finally {
      setBusy(false)
      setConfirmingId(null)
    }
  }

  const canSave = !saving && name.trim() !== '' && primary !== ''

  return (
    <div className="page-shell">
      <main className="page-card plans-card">
        <h1>{t('exercises.title')}</h1>
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
          <button type="submit" className="btn-primary" disabled={!canSave}>
            {saving ? t('exercises.adding') : t('exercises.add')}
          </button>
        </form>
        <section className="workout-section" aria-live="polite">
          <h2>{t('exercises.yours')}</h2>
          {loading ? (
            <p className="page-subtext">{t('exercises.loading')}</p>
          ) : loadFailed ? null : exercises.length === 0 ? (
            <p className="page-subtext">{t('exercises.empty')}</p>
          ) : (
            <ul className="plan-list">
              {sortExercisesByName(exercises).map((exercise) => (
                <li key={exercise.id} className="plan-item">
                  <div className="plan-item-info">
                    <span className="plan-item-name">{exerciseName(exercise)}</span>
                    <span>
                      {muscleGroupLabel(exercise.primaryMuscleGroup)}
                      {exercise.secondaryMuscleGroups.length > 0 &&
                        ` · ${exercise.secondaryMuscleGroups.map(muscleGroupLabel).join(', ')}`}
                    </span>
                  </div>
                  {confirmingId === exercise.id ? (
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
                        onClick={() => setConfirmingId(null)}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setConfirmingId(exercise.id)}
                    >
                      {t('common.delete')}
                    </button>
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
