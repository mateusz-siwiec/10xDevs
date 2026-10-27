import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createExercise, deleteExercise, getExercises } from '../api/client'
import type { Exercise } from '../api/client'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/plans.css'
import '../styles/exercises.css'

const MUSCLE_GROUPS = [
  'CHEST',
  'BACK',
  'SHOULDERS',
  'BICEPS',
  'TRICEPS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'CORE',
]

const NAME_MAX_LENGTH = 60

function formatGroup(group: string): string {
  return group.charAt(0) + group.slice(1).toLowerCase()
}

function byName(a: Exercise, b: Exercise): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export default function MyExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        if (!cancelled) setExercises(list.filter((e) => e.custom).sort(byName))
      })
      .catch((err) => {
        if (cancelled) return
        setLoadFailed(true)
        setError(err instanceof Error ? err.message : 'Failed to load exercises')
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
      setExercises((list) => [...list, created].sort(byName))
      setName('')
      setPrimary('')
      setSecondary([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exercise')
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
      setError(err instanceof Error ? err.message : 'Failed to delete exercise')
    } finally {
      setBusy(false)
      setConfirmingId(null)
    }
  }

  const canSave = !saving && name.trim() !== '' && primary !== ''

  return (
    <div className="page-shell">
      <main className="page-card plans-card">
        <h1>My exercises</h1>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="exercise-name">Name</label>
            <input
              id="exercise-name"
              type="text"
              maxLength={NAME_MAX_LENGTH}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="exercise-primary">Primary muscle group</label>
            <select
              id="exercise-primary"
              className="workout-select"
              value={primary}
              onChange={(event) => handlePrimaryChange(event.target.value)}
            >
              <option value="" disabled>
                Choose a muscle group…
              </option>
              {MUSCLE_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {formatGroup(group)}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="exercise-secondary">
            <legend>Secondary muscle groups (optional)</legend>
            <div className="exercise-secondary-options">
              {MUSCLE_GROUPS.filter((group) => group !== primary).map((group) => (
                <label key={group} className="exercise-secondary-option">
                  <input
                    type="checkbox"
                    checked={secondary.includes(group)}
                    onChange={() => toggleSecondary(group)}
                  />
                  {formatGroup(group)}
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={!canSave}>
            {saving ? 'Adding…' : 'Add exercise'}
          </button>
        </form>
        <section className="workout-section" aria-live="polite">
          <h2>Your exercises</h2>
          {loading ? (
            <p className="page-subtext">Loading exercises…</p>
          ) : loadFailed ? null : exercises.length === 0 ? (
            <p className="page-subtext">No custom exercises yet.</p>
          ) : (
            <ul className="plan-list">
              {exercises.map((exercise) => (
                <li key={exercise.id} className="plan-item">
                  <div className="plan-item-info">
                    <span className="plan-item-name">{exercise.name}</span>
                    <span>
                      {formatGroup(exercise.primaryMuscleGroup)}
                      {exercise.secondaryMuscleGroups.length > 0 &&
                        ` · ${exercise.secondaryMuscleGroups.map(formatGroup).join(', ')}`}
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
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => setConfirmingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setConfirmingId(exercise.id)}
                    >
                      Delete
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
