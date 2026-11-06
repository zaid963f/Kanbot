import { useI18n } from '../context/I18nContext';
import { useAiStatus } from '../hooks/useAiStatus';
import type { AiSource } from '../types/api';
import Icon from './Icon';

// Shows "Mock AI" when the answers come from the server's rule-based fake, not a real model.
// Pass `source` to label one specific answer; otherwise the server's current mode is used.
export function MockBadge({ source }: { source?: AiSource }) {
  const status = useAiStatus();
  const { t } = useI18n();
  const mode = source ?? status.data?.mode;
  if (mode !== 'mock') return null;
  return (
    <span className="ai-badge ai-badge-mock" title={t('ai.mockTitle')}>
      {t('ai.mock')}
    </span>
  );
}

export function AiDisclaimer() {
  const { t } = useI18n();
  return <p className="ai-disclaimer">{t('ai.disclaimer')}</p>;
}

export function AiThinking({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="ai-thinking" role="status">
      <Icon name="sparkles" size={14} />
      <span>{label ?? t('ai.thinking')}</span>
      <span className="ai-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
