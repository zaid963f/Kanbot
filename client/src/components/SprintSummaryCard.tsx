import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { summarizeSprint } from '../api/ai';
import { useI18n } from '../context/I18nContext';
import type { Sprint, SprintSummary } from '../types/api';
import { formatDateTime } from '../utils/format';
import { AiDisclaimer, AiThinking, MockBadge } from './AiBits';
import Icon from './Icon';
import Markdown from './Markdown';
import { ErrorMessage } from './States';

interface Props {
  sprint: Sprint;
  // On the board the card starts folded so the columns stay in view.
  collapsible?: boolean;
}

// AI-4: the saved sprint summary, with Summarize / Regenerate.
export default function SprintSummaryCard({ sprint, collapsible = false }: Props) {
  const queryClient = useQueryClient();
  const [fresh, setFresh] = useState<SprintSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [expanded, setExpanded] = useState(!collapsible);
  const { t } = useI18n();

  // The one we just generated wins until the sprints list is refetched.
  const summary = fresh && (!sprint.summary || fresh.generatedAt >= sprint.summary.generatedAt) ? fresh : sprint.summary;

  if (sprint.status === 'planned') return null;

  async function handleSummarize() {
    setLoading(true);
    setError(null);
    setExpanded(true);
    try {
      const data = await summarizeSprint(sprint.id);
      setFresh(data.summary);
      queryClient.invalidateQueries({ queryKey: ['sprints', sprint.projectId] });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  const showBody = expanded || loading || Boolean(error);

  return (
    <section className="card summary-card" aria-labelledby={`summary-${sprint.id}`}>
      <div className="summary-head">
        <span className="ai-mark" aria-hidden="true">
          <Icon name="sparkles" size={14} />
        </span>
        <h3 id={`summary-${sprint.id}`}>{t('summary.title')}</h3>
        {summary && <MockBadge source={summary.source} />}
        {summary && <small className="muted">{t('summary.generated', { date: formatDateTime(summary.generatedAt) })}</small>}
        <span className="spacer" />
        {collapsible && summary && !loading && (
          <button type="button" className="button button-small" aria-expanded={showBody} onClick={() => setExpanded(!expanded)}>
            {showBody ? t('summary.hide') : t('summary.show')}
          </button>
        )}
        <button
          type="button"
          className={summary ? 'button button-small' : 'button button-small button-dark'}
          onClick={handleSummarize}
          disabled={loading}
        >
          {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Icon name={summary ? 'refresh' : 'sparkles'} size={14} />}
          {loading ? t('summary.summarizing') : summary ? t('summary.regenerate') : t('summary.summarize')}
        </button>
      </div>

      {!summary && !loading && !error && (
        <p className="muted summary-empty">
          {sprint.status === 'active' ? t('summary.emptyActive') : t('summary.emptyDone')}
        </p>
      )}

      {showBody && (
        <div className="summary-body">
          {loading && (
            <>
              <AiThinking label={t('summary.writing')} />
              <div className="skeleton-list" aria-hidden="true">
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line short" />
              </div>
            </>
          )}
          {!loading && Boolean(error) && <ErrorMessage error={error} onRetry={handleSummarize} />}
          {!loading && summary && (
            <>
              <Markdown>{summary.content}</Markdown>
              <AiDisclaimer />
            </>
          )}
        </div>
      )}
    </section>
  );
}
