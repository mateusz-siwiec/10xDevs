import { useEffect, useMemo, useState } from 'react'
import {
  deleteSet,
  endSession,
  getCurrentSession,
  getExercises,
  logSet,
  startSession,
} from '../api/client'
import type { Exercise, WorkoutSession } from '../api/client'
import ExercisePicker from '../components/ExercisePicker'
import ProgressionChart from '../components/ProgressionChart'
import SessionSetList from '../components/SessionSetList'
import SetLogger from '../components/SetLogger'
import '../styles/page.css'
import '../styles/workout.css'

export default function WorkoutPage() {
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    Promise.all([getExercises(), getCurrentSession()])
      .then(([exerciseList, current]) => {
        setExercises(exerciseList)
        setSession(current)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load workout'))
      .finally(() => setLoading(false))
  }, [])

  const exerciseNames = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])

  async function handleStart() {
    setError(null)
    setBusy(true)
    try {
      setSession(await startSession())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start workout')
    } finally {
      setBusy(false)
    }
  }

  async function handleEnd() {
    if (!session) return
    setError(null)
    setBusy(true)
    try {
      await endSession(session.id)
      setSession(null)
      setSelectedExercise('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end workout')
    } finally {
      setBusy(false)
    }
  }

  // Rethrows so SetLogger knows the log failed; the message is shown inline here.
  async function handleLog(reps: number, weightKg: number) {
    if (!session) return
    setError(null)
    try {
      const set = await logSet(session.id, { exerciseId: selectedExercise, reps, weightKg })
      setSession({ ...session, sets: [...session.sets, set] })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log set')
      throw err
    }
  }

  async function handleDelete(setId: string) {
    if (!session) return
    setError(null)
    try {
      await deleteSet(session.id, setId)
      setSession({ ...session, sets: session.sets.filter((s) => s.id !== setId) })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete set')
    }
  }

  if (loading) {
    return null
  }

  return (
    <div className="page-shell">
      <main className="page-card workout-card">
        <h1>Workout</h1>
        {error && <p className="error-text">{error}</p>}
        {session === null ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={handleStart}>
            {busy ? 'Starting…' : 'Start workout'}
          </button>
        ) : (
          <>
            <ExercisePicker
              exercises={exercises}
              selectedId={selectedExercise}
              onChange={setSelectedExercise}
            />
            <SetLogger disabled={!selectedExercise} onLog={handleLog} />
            {selectedExercise && (
              <ProgressionChart exerciseId={selectedExercise} refreshKey={refreshKey} />
            )}
            <section className="workout-section">
              <h2>Logged sets</h2>
              <SessionSetList
                sets={session.sets}
                exerciseNames={exerciseNames}
                onDelete={handleDelete}
              />
            </section>
            <button
              type="button"
              className="btn-secondary workout-end"
              disabled={busy}
              onClick={handleEnd}
            >
              End workout
            </button>
          </>
        )}
      </main>
    </div>
  )
}
