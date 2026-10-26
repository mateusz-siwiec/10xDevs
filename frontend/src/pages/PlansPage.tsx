import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { deletePlan, listPlans } from '../api/client'
import type { PlanSummary } from '../api/client'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/plans.css'

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listPlans()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plans'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    setError(null)
    setBusy(true)
    try {
      await deletePlan(id)
      setPlans((list) => list.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan')
    } finally {
      setBusy(false)
      setConfirmingId(null)
    }
  }

  return (
    <div className="page-shell">
      <main className="page-card plans-card">
        <div className="plans-header">
          <h1>Plans</h1>
          <Link to="/plans/new" className="plans-link-button">
            New plan
          </Link>
        </div>
        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p className="page-subtext">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="page-subtext">You have no plans yet. Create one to get started.</p>
        ) : (
          <ul className="plan-list">
            {plans.map((plan) => (
              <li key={plan.id} className="plan-item">
                <div className="plan-item-info">
                  <span className="plan-item-name">{plan.name}</span>
                  <span>
                    {plan.exerciseCount} {plan.exerciseCount === 1 ? 'exercise' : 'exercises'}
                  </span>
                </div>
                {confirmingId === plan.id ? (
                  <div className="plan-item-actions">
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busy}
                      onClick={() => handleDelete(plan.id)}
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
                  <div className="plan-item-actions">
                    <Link to={`/plans/${plan.id}`} className="btn-secondary">
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setConfirmingId(plan.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
