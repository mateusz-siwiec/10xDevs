import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { createPlan, getExercises, getPlan, updatePlan } from '../api/client'
import type { Exercise } from '../api/client'
import ExercisePicker from '../components/ExercisePicker'
import PlanExerciseList from '../components/PlanExerciseList'
import type { PlanEditorEntry, PlanTargetField } from '../components/PlanExerciseList'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/plans.css'

// Empty or non-integer text becomes null (rejected by the server) so fractions like 3.5 are never truncated.
function toTarget(value: string): number | null {
  const n = Number(value)
  return value.trim() === '' || !Number.isInteger(n) ? null : n
}

function PlanEditor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [entries, setEntries] = useState<PlanEditorEntry[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getExercises(), id ? getPlan(id) : Promise.resolve(null)])
      .then(([exerciseList, plan]) => {
        if (cancelled) return
        setExercises(exerciseList)
        if (plan) {
          setName(plan.name)
          setEntries(
            [...plan.exercises]
              .sort((a, b) => a.position - b.position)
              .map((e) => ({
                key: crypto.randomUUID(),
                exerciseId: e.exerciseId,
                exerciseName: e.exerciseName,
                sets: String(e.sets),
                reps: String(e.reps),
              })),
          )
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLoadFailed(true)
        setError(err instanceof Error ? err.message : 'Failed to load plan')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  function handleAdd() {
    const exercise = exercises.find((e) => e.id === selectedExercise)
    if (!exercise) return
    setEntries((list) => [
      ...list,
      {
        key: crypto.randomUUID(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: '3',
        reps: '10',
      },
    ])
  }

  function handleMove(index: number, delta: -1 | 1) {
    setEntries((list) => {
      const target = index + delta
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function handleRemove(key: string) {
    setEntries((list) => list.filter((e) => e.key !== key))
  }

  function handleTargetChange(key: string, field: PlanTargetField, value: string) {
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, [field]: value } : e)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    const input = {
      name: name.trim(),
      entries: entries.map((e) => ({
        exerciseId: e.exerciseId,
        sets: toTarget(e.sets),
        reps: toTarget(e.reps),
      })),
    }
    try {
      if (id) {
        await updatePlan(id, input)
      } else {
        await createPlan(input)
      }
      navigate('/plans')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <main className="page-card plans-card">
          <p className="page-subtext">Loading…</p>
        </main>
      </div>
    )
  }

  if (loadFailed) {
    return (
      <div className="page-shell">
        <main className="page-card plans-card">
          <h1>Edit plan</h1>
          {error && <p className="error-text">{error}</p>}
          <Link to="/plans" className="btn-secondary">
            Back to plans
          </Link>
        </main>
      </div>
    )
  }

  const canSave = !saving && name.trim() !== '' && entries.length > 0

  return (
    <div className="page-shell">
      <main className="page-card plans-card">
        <h1>{id ? 'Edit plan' : 'New plan'}</h1>
        {error && <p className="error-text">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="plan-name">Plan name</label>
            <input
              id="plan-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <ExercisePicker
            exercises={exercises}
            selectedId={selectedExercise}
            onChange={setSelectedExercise}
          />
          <button
            type="button"
            className="btn-secondary plan-add-button"
            disabled={!selectedExercise || saving}
            onClick={handleAdd}
          >
            Add exercise
          </button>
          <section className="workout-section">
            <h2>Exercises</h2>
            <PlanExerciseList
              entries={entries}
              disabled={saving}
              onMove={handleMove}
              onRemove={handleRemove}
              onTargetChange={handleTargetChange}
            />
          </section>
          <div className="plan-editor-footer">
            <button type="submit" className="btn-primary" disabled={!canSave}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <Link to="/plans" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}

// Keyed on the route id so switching plans (or /plans/new) remounts with fresh state.
export default function PlanEditorPage() {
  const { id } = useParams()
  return <PlanEditor key={id ?? 'new'} />
}
