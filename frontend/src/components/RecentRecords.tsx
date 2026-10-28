import type { RecentPersonalRecord } from '../api/client'

interface RecentRecordsProps {
  records: RecentPersonalRecord[]
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function RecentRecords({ records }: RecentRecordsProps) {
  return (
    <section className="dashboard-section">
      <h2>Recent records</h2>
      {records.length === 0 ? (
        <p className="page-subtext">No personal records yet. Keep lifting.</p>
      ) : (
        <ul className="recent-records">
          {records.slice(0, 5).map((record) => (
            <li key={`${record.sessionId}:${record.exerciseId}:${record.achievedAt}`}>
              <span className="recent-record-name">
                {record.exerciseName}{' '}
                <span className="pr-badge" role="img" aria-label="New personal record">
                  PR
                </span>
              </span>
              <span className="recent-record-detail">
                {record.weightKg} kg x {record.reps} · {formatDate(record.achievedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
