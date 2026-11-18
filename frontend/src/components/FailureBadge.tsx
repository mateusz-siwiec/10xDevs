import { useTranslation } from 'react-i18next'

/** Small badge marking a set taken to muscular failure (text + accessible label, not colour only). */
export default function FailureBadge() {
  const { t } = useTranslation()
  return (
    <span className="failure-badge" role="img" aria-label={t('common.failureSet')}>
      {t('common.failureBadge')}
    </span>
  )
}
