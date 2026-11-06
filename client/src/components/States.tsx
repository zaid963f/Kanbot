import type { ReactNode } from 'react';
import { getErrorMessage } from '../api/client';
import { useI18n } from '../context/I18nContext';
import Icon, { type IconName } from './Icon';

export function Loading() {
  const { t } = useI18n();
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {t('common.loading')}
    </div>
  );
}

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="error-box" role="alert">
      <Icon name="alert" />
      <p>{getErrorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          {t('common.tryAgain')}
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  text,
  children,
  icon = 'backlog',
}: {
  title: string;
  text: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
