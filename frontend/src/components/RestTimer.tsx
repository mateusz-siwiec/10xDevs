import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { REST_PRESETS } from './restDuration'

interface RestTimerProps {
  endsAt: number | null
  onChange: (endsAt: number | null) => void
  durationSec: number
  onDurationChange: (sec: number) => void
}

interface CountdownProps {
  endsAt: number
  onChange: (endsAt: number | null) => void
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const seconds = total % 60
  return `${Math.floor(total / 60)}:${seconds < 10 ? '0' : ''}${seconds}`
}

// Remounted per endsAt (see key below) so `now` starts fresh and the vibration fires once per rest.
function Countdown({ endsAt, onChange }: CountdownProps) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const remaining = endsAt - now
  const over = remaining <= 0

  // Recomputing from Date.now() keeps the display correct after the tab was backgrounded.
  useEffect(() => {
    if (over) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [over])

  useEffect(() => {
    if (over) navigator.vibrate?.([200, 100, 200])
  }, [over])

  return (
    <div className="rest-timer">
      <p className="rest-timer-display">{over ? t('workout.rest.over') : formatRemaining(remaining)}</p>
      <p className="rest-timer-live" aria-live="polite">
        {over ? t('workout.rest.over') : ''}
      </p>
      <div className="rest-timer-actions">
        {!over && (
          <button type="button" className="btn-secondary" onClick={() => onChange(endsAt + 30_000)}>
            {t('workout.rest.addSeconds')}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => onChange(null)}>
          {over ? t('workout.rest.dismiss') : t('workout.rest.skipRest')}
        </button>
      </div>
    </div>
  )
}

export default function RestTimer({ endsAt, onChange, durationSec, onDurationChange }: RestTimerProps) {
  const { t } = useTranslation()
  if (endsAt !== null) {
    return <Countdown key={endsAt} endsAt={endsAt} onChange={onChange} />
  }

  return (
    <div className="rest-timer">
      <label htmlFor="rest-duration">{t('workout.rest.between')}</label>
      <select
        id="rest-duration"
        className="workout-select"
        value={durationSec}
        onChange={(event) => onDurationChange(Number(event.target.value))}
      >
        {REST_PRESETS.map((sec) => (
          <option key={sec} value={sec}>
            {t('workout.rest.seconds', { sec })}
          </option>
        ))}
      </select>
    </div>
  )
}
