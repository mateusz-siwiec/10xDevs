import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { computeProgress, currentIndex, selectedIndex } from '../components/planProgress'
import ProgressionChart from '../components/ProgressionChart'
import PreviousWorkoutHint from '../components/PreviousWorkoutHint'
import ProgressionRecommendation from '../components/ProgressionRecommendation'
import RestTimer from '../components/RestTimer'
import { loadRestDuration, saveRestDuration } from '../components/restDuration'
import SessionSetList from '../components/SessionSetList'
import SetLogger from '../components/SetLogger'
import SubstituteSuggestions from '../components/SubstituteSuggestions'
import '../styles/page.css'
import '../styles/workout.css'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'

export default function WorkoutPage() {
  const { t } = useTranslation()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [startPlanId, setStartPlanId] = useState('')
  const [planState, setPlanState] = useState<{ planId: string; plan: Plan | null } | null>(null)
  // A manual pick is only honoured while the plan's auto-selected exercise is unchanged.
  const [manual, setManual] = useState<{ exerciseId: string; autoId: string } | null>(null)
  // Exercise id the substitutes panel is open for; rendered only while it matches the selection.
  const [substituteFor, setSubstituteFor] = useState<string | null>(null)
  // Entry positions the user skipped in the active session; cleared on return, log and end.
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(() => new Set())
  // Absolute end time of the running rest countdown; null when no rest is active.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [restDuration, setRestDuration] = useState(loadRestDuration)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    Promise.all([getExercises(), getCurrentSession(), listPlans().catch(() => [] as PlanSummary[])])
      .then(([exerciseList, current, planList]) => {
        setExercises(exerciseList)
        setSession(current)
        setPlans(planList)
      })
      .catch((err) => setError({ err, key: 'workout.loadFailed' }))
      .finally(() => setLoading(false))
  }, [])

  const exercisesById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

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
  const autoIndex = progress ? currentIndex(progress, skipped) : -1
  // Once every entry is done, stay on the last one so extra sets can still be logged.
  const autoId = progress && progress.length > 0 ? progress[autoIndex >= 0 ? autoIndex : progress.length - 1].entry.exerciseId : ''
  const selectedExercise = manual && manual.autoId === autoId ? manual.exerciseId : autoId
  // Only skipped entries are left to do: the walkthrough has fallen back to the first of them.
  const showReturnHint =
    progress !== null &&
    progress.some((p) => p.logged < p.entry.sets && skipped.has(p.entry.position)) &&
    !progress.some((p) => p.logged < p.entry.sets && !skipped.has(p.entry.position))

  function handleSelect(exerciseId: string, entryPosition?: number) {
    // Returning to a skipped entry clears its skip; recompute the auto entry so the pick stays honoured.
    let nextAutoId = autoId
    if (progress) {
      // A walkthrough tap names its entry; picker picks fall back to the entry that exercise highlights.
      const position =
        entryPosition ?? progress[selectedIndex(progress, autoIndex, exerciseId)]?.entry.position
      if (position !== undefined && skipped.has(position)) {
        const nextSkipped = new Set(skipped)
        nextSkipped.delete(position)
        const nextIndex = currentIndex(progress, nextSkipped)
        nextAutoId = progress[nextIndex >= 0 ? nextIndex : progress.length - 1].entry.exerciseId
        setSkipped(nextSkipped)
      }
    }
    setManual({ exerciseId, autoId: nextAutoId })
    setSubstituteFor(null)
  }

  function handleSkip(position: number) {
    setSkipped((s) => new Set(s).add(position))
    setManual(null)
    setSubstituteFor(null)
  }

  async function handleStart(planId?: string) {
    setError(null)
    setBusy(true)
    try {
      setSession(await startSession(planId))
      setSkipped(new Set())
      setRestEndsAt(null)
    } catch (err) {
      setError({ err, key: 'workout.startFailed' })
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
      setSubstituteFor(null)
      setSkipped(new Set())
      setRestEndsAt(null)
    } catch (err) {
      setError({ err, key: 'workout.endFailed' })
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
      // Logging against a skipped entry counts as returning to it.
      if (progress) {
        const position = progress[selectedIndex(progress, autoIndex, selectedExercise)]?.entry.position
        if (position !== undefined && skipped.has(position)) {
          setSkipped((s) => {
            const next = new Set(s)
            next.delete(position)
            return next
          })
        }
      }
      setRestEndsAt(Date.now() + restDuration * 1000)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError({ err, key: 'workout.logFailed' })
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
      // Deleting can change which remaining sets are records, so reload the flags from the server.
      // A failed or empty refetch keeps the local filter above.
      try {
        const fresh = await getCurrentSession()
        if (fresh && fresh.id === session.id) {
          // Only the flags are taken from the server; a set logged meanwhile must not be dropped.
          const flags = new Map(fresh.sets.map((x) => [x.id, x.personalRecord]))
          setSession((s) =>
            s && s.id === session.id
              ? { ...s, sets: s.sets.map((x) => ({ ...x, personalRecord: flags.get(x.id) ?? x.personalRecord })) }
              : s,
          )
        }
      } catch {
        // the delete itself succeeded; the filtered list is already shown
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError({ err, key: 'workout.deleteFailed' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <main className="page-card workout-card">
          <h1>{t('workout.title')}</h1>
          <div role="status">
            <span className="visually-hidden">{t('workout.loading')}</span>
            <div className="skeleton skeleton-button" aria-hidden="true" />
            <div className="skeleton skeleton-block" aria-hidden="true" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <main className="page-card workout-card">
        <h1>{t('workout.title')}</h1>
        {error && <p className="error-text" role="alert">{translateError(error.err, error.key)}</p>}
        {session === null ? (
          <div className="workout-start">
            {plans.length > 0 && (
              <div className="workout-start-plan">
                <select
                  className="workout-select"
                  aria-label={t('workout.startFromPlanLabel')}
                  value={startPlanId}
                  onChange={(event) => setStartPlanId(event.target.value)}
                >
                  <option value="">{t('workout.startFromPlan')}</option>
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
                  {t('workout.startPlan')}
                </button>
              </div>
            )}
            <button type="button" className="btn-primary" disabled={busy} onClick={() => handleStart()}>
              {busy ? t('workout.starting') : t('workout.startWorkout')}
            </button>
          </div>
        ) : (
          <>
            {showReturnHint && <p className="walkthrough-return-hint">{t('workout.returnToSkipped')}</p>}
            {progress && (
              <PlanWalkthrough
                progress={progress}
                selectedExerciseId={selectedExercise}
                skipped={skipped}
                onSelect={handleSelect}
                onSkip={handleSkip}
              />
            )}
            <div className="exercise-picker-row">
              <ExercisePicker
                exercises={exercises}
                selectedId={selectedExercise}
                onChange={handleSelect}
              />
              <button
                type="button"
                className="btn-secondary find-substitute-btn"
                disabled={!selectedExercise}
                onClick={() => setSubstituteFor(selectedExercise)}
              >
                {t('workout.findSubstitute')}
              </button>
            </div>
            {selectedExercise && substituteFor === selectedExercise && (
              <SubstituteSuggestions
                exerciseId={selectedExercise}
                onAccept={handleSelect}
                onDismiss={() => setSubstituteFor(null)}
              />
            )}
            {selectedExercise && sessionPlanId && (
              <PreviousWorkoutHint
                exerciseId={selectedExercise}
                planId={sessionPlanId}
                setNumber={(session?.sets.filter((s) => s.exerciseId === selectedExercise).length ?? 0) + 1}
              />
            )}
            {selectedExercise && <ProgressionRecommendation exerciseId={selectedExercise} />}
            <SetLogger disabled={!selectedExercise} onLog={handleLog} />
            <RestTimer
              endsAt={restEndsAt}
              onChange={setRestEndsAt}
              durationSec={restDuration}
              onDurationChange={(sec) => {
                setRestDuration(sec)
                saveRestDuration(sec)
              }}
            />
            {selectedExercise && (
              <ProgressionChart exerciseId={selectedExercise} refreshKey={refreshKey} />
            )}
            <section className="workout-section">
              <h2>{t('workout.loggedSets')}</h2>
              <SessionSetList
                sets={session.sets}
                exercisesById={exercisesById}
                onDelete={handleDelete}
              />
            </section>
            <button
              type="button"
              className="btn-secondary workout-end"
              disabled={busy}
              onClick={handleEnd}
            >
              {t('workout.endWorkout')}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
