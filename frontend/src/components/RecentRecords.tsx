import { useTranslation } from 'react-i18next'
import type { Exercise, RecentPersonalRecord } from '../api/client'
import { exerciseName } from '../utils/exercises'
import { formatShortDate } from '../utils/format'

interface RecentRecordsProps {
  records: RecentPersonalRecord[]
  /** Used to show seeded exercise names in the active language; records fall back to their stored name. */
  exercises: Exercise[]
}

function displayName(exercise: Exercise | undefined, fallback: string): string {
  return exercise ? exerciseName(exercise) : fallback
}

export default function RecentRecords({ records, exercises }: RecentRecordsProps) {
  const { t } = useTranslation()
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  return (
    <section className="dashboard-section">
      <h2>{t('dashboard.recentRecords.title')}</h2>
      {records.length === 0 ? (
        <p className="page-subtext">{t('dashboard.recentRecords.empty')}</p>
      ) : (
        <ul className="recent-records">
          {records.slice(0, 5).map((record) => (
            <li className="card" key={`${record.sessionId}:${record.exerciseId}:${record.achievedAt}`}>
              <span className="recent-record-name">
                {displayName(byId.get(record.exerciseId), record.exerciseName)}{' '}
                <span className="pr-badge" role="img" aria-label={t('common.personalRecord')}>
                  {t('common.prBadge')}
                </span>
              </span>
              <span className="recent-record-detail">
                {record.weightKg} kg x {record.reps} · {formatShortDate(record.achievedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
