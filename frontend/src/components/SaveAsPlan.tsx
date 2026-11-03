import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { createPlan } from '../api/client'
import { PLAN_NAME_MAX_LENGTH, workoutToPlanEntries } from '../utils/workoutToPlan'
import type { LoggedSet } from '../utils/workoutToPlan'
import { translateError } from '../utils/errors'
import '../styles/page.css'

interface Props {
  sets: readonly LoggedSet[]
  defaultName: string
}

export default function SaveAsPlan({ sets, defaultName }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus and select the prefilled name so typing replaces it straight away.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [open])

  const entries = workoutToPlanEntries(sets)
  if (entries.length === 0) return null

  if (savedId !== null) {
    return (
      <div className="save-as-plan" role="status">
        <span>{t('saveAsPlan.success')}</span>
        <Link to={`/plans/${savedId}`} className="save-as-plan-link">
          {t('saveAsPlan.viewPlan')}
        </Link>
      </div>
    )
  }

  function openForm() {
    setName(defaultName)
    setError(null)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (submitting || trimmed === '') return
    setError(null)
    setSubmitting(true)
    try {
      const plan = await createPlan({ name: trimmed, entries })
      setSavedId(plan.id)
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div className="save-as-plan">
        <button type="button" className="btn-secondary" onClick={openForm}>
          {t('saveAsPlan.button')}
        </button>
      </div>
    )
  }

  return (
    <div className="save-as-plan">
      <form className="save-as-plan-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="save-as-plan-name">{t('saveAsPlan.nameLabel')}</label>
          <input
            id="save-as-plan-name"
            ref={inputRef}
            type="text"
            value={name}
            maxLength={PLAN_NAME_MAX_LENGTH}
            disabled={submitting}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {error !== null && (
          <p className="error-text" role="alert">
            {translateError(error, 'saveAsPlan.failed')}
          </p>
        )}
        <div className="save-as-plan-buttons">
          <button type="submit" className="btn-primary" disabled={submitting || name.trim() === ''}>
            {submitting ? t('saveAsPlan.saving') : t('saveAsPlan.save')}
          </button>
          <button type="button" className="btn-secondary" disabled={submitting} onClick={() => setOpen(false)}>
            {t('saveAsPlan.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
