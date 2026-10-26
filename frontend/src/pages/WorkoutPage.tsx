import { useEffect, useMemo, useState } from 'react'
import {
  deleteSet,
  endSession,
  getCurrentSession,
  getExercises,
  getPlan,
  listPlans,
  logSet,
  startSession,
} from '../api/client'
import type { Exercise, Plan, PlanSummary, WorkoutSession } from '../api/client'
import ExercisePicker from '../components/ExercisePicker'
import PlanWalkthrough from '../components/PlanWalkthrough'
import { computeProgress, currentIndex } from '../components/planProgress'
import ProgressionChart from '../components/ProgressionChart'
import SessionSetList from '../components/SessionSetList'
import SetLogger from '../components/SetLogger'
import '../styles/page.css'
import '../styles/workout.css'

export default function WorkoutPage() {
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [startPlanId, setStartPlanId] = useState('')
  const [planState, setPlanState] = useState<{ planId: string; plan: Plan | null } | null>(null)
  // A manual pick is only honoured while the plan's auto-selected exercise is unchanged.
  const [manual, setManual] = useState<{ exerciseId: string; autoId: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    Promise.all([getExercises(), getCurrentSession(), listPlans().catch(() => [] as PlanSummary[])])
      .then(([exerciseList, current, planList]) => {
        setExercises(exerciseList)
        setSession(current)
        setPlans(planList)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load workout'))
      .finally(() => setLoading(false))
  }, [])

  const exerciseNames = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])

  const sessionId = session?.id ?? null
  const sessionPlanId = session?.planId ?? null

  // A deleted or unavailable plan silently falls back to the free-form view.
  useEffect(() => {
    if (!sessionId || !sessionPlanId) return
    let cancelled = false
    getPlan(sessionPlanId)
      .then((plan) => !cancelled && setPlanState({ planId: sessionPlanId, plan }))
      .catch(() => !cancelled && setPlanState({ planId: sessionPlanId, plan: null }))
    return () => {
      cancelled = true
    }
  }, [sessionId, sessionPlanId])

  const plan = sessionPlanId && planState?.planId === sessionPlanId ? planState.plan : null
  const progress = useMemo(
    () => (plan && session ? computeProgress(plan.exercises, session.sets) : null),
    [plan, session],
  )
  const autoIndex = progress ? currentIndex(progress) : -1
  // Once every entry is done, stay on the last one so extra sets can still be logged.
  const autoId = progress && progress.length > 0 ? progress[autoIndex >= 0 ? autoIndex : progress.length - 1].entry.exerciseId : ''
  const selectedExercise = manual && manual.autoId === autoId ? manual.exerciseId : autoId

  function handleSelect(exerciseId: string) {
    setManual({ exerciseId, autoId })
  }

  async function handleStart(planId?: string) {
    setError(null)
    setBusy(true)
    try {
      setSession(await startSession(planId))
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
      setManual(null)
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
    setBusy(true)
    try {
      const set = await logSet(session.id, { exerciseId: selectedExercise, reps, weightKg })
      setSession((s) => (s && s.id === session.id ? { ...s, sets: [...s.sets, set] } : s))
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log set')
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(setId: string) {
    if (!session) return
    setError(null)
    setBusy(true)
    try {
      await deleteSet(session.id, setId)
      setSession((s) =>
        s && s.id === session.id ? { ...s, sets: s.sets.filter((x) => x.id !== setId) } : s,
      )
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete set')
    } finally {
      setBusy(false)
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
          <div className="workout-start">
            {plans.length > 0 && (
              <div className="workout-start-plan">
                <select
                  className="workout-select"
                  aria-label="Start from plan"
                  value={startPlanId}
                  onChange={(event) => setStartPlanId(event.target.value)}
                >
                  <option value="">Start from plan…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || !startPlanId}
                  onClick={() => handleStart(startPlanId)}
                >
                  Start plan
                </button>
              </div>
            )}
            <button type="button" className="btn-primary" disabled={busy} onClick={() => handleStart()}>
              {busy ? 'Starting…' : 'Start workout'}
            </button>
          </div>
        ) : (
          <>
            {progress && (
              <PlanWalkthrough
                progress={progress}
                selectedExerciseId={selectedExercise}
                onSelect={handleSelect}
              />
            )}
            <ExercisePicker
              exercises={exercises}
              selectedId={selectedExercise}
              onChange={handleSelect}
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
