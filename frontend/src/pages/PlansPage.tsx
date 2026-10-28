import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { deletePlan, listPlans } from '../api/client'
import type { PlanSummary } from '../api/client'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/plans.css'
import { translateError } from '../utils/errors'

export default function PlansPage() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listPlans()
      .then(setPlans)
      .catch((err) => setError(translateError(err, 'plans.loadFailed')))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    setError(null)
    setBusy(true)
    try {
      await deletePlan(id)
      setPlans((list) => list.filter((p) => p.id !== id))
    } catch (err) {
      setError(translateError(err, 'plans.deleteFailed'))
    } finally {
      setBusy(false)
      setConfirmingId(null)
    }
  }

  return (
    <div className="page-shell">
      <main className="page-card plans-card">
        <div className="plans-header">
          <h1>{t('plans.title')}</h1>
          <Link to="/plans/new" className="plans-link-button">
            {t('plans.newPlan')}
          </Link>
        </div>
        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p className="page-subtext">{t('plans.loading')}</p>
        ) : plans.length === 0 ? (
          <p className="page-subtext">{t('plans.empty')}</p>
        ) : (
          <ul className="plan-list">
            {plans.map((plan) => (
              <li key={plan.id} className="plan-item">
                <div className="plan-item-info">
                  <span className="plan-item-name">{plan.name}</span>
                  <span>
                    {t('plans.exerciseCount', { count: plan.exerciseCount })}
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
                  <div className="plan-item-actions">
                    <Link to={`/plans/${plan.id}`} className="btn-secondary">
                      {t('common.edit')}
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setConfirmingId(plan.id)}
                    >
                      {t('common.delete')}
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
