import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { generateTodos } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { bulkCreateTodos } from '../api/todos';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { refreshProjectData } from '../hooks/useProjectData';
import { useWorkflow } from '../hooks/useWorkflow';
import { STORY_POINTS, TODO_TYPES } from '../types/api';
import type { AiSource, DraftTodo, StoryPoints, TodoType } from '../types/api';
import { typeLabel } from '../utils/labels';
import { AiDisclaimer, AiThinking, MockBadge } from './AiBits';
import Icon from './Icon';
import Modal from './Modal';
import { ErrorMessage } from './States';

interface Draft extends DraftTodo {
  id: number; // local key for React
  selected: boolean;
}

interface Props {
  projectId: string;
  initialPrompt?: string;
  onClose: () => void;
}

let nextDraftId = 1;

export default function GenerateTodosModal({ projectId, initialPrompt = '', onClose }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const workflow = useWorkflow(projectId);
  const navigate = useNavigate();
  const location = useLocation();

  const [prompt, setPrompt] = useState(initialPrompt);
  const [count, setCount] = useState(5);
  const [promptError, setPromptError] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [source, setSource] = useState<AiSource | undefined>();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const selected = drafts?.filter((d) => d.selected) ?? [];
  const selectedPoints = selected.reduce((sum, d) => sum + (d.storyPoints ?? 0), 0);
  const hasEmptyTitle = selected.some((d) => !d.title.trim());
  const busy = generating || saving;

  async function handleGenerate(event?: FormEvent) {
    event?.preventDefault();
    if (prompt.trim().length < 3) {
      setPromptError(t('gen.tooShort'));
      return;
    }
    setPromptError('');
    setGenerateError(null);
    setGenerating(true);
    try {
      const data = await generateTodos(projectId, { prompt: prompt.trim(), count });
      setDrafts(data.todos.map((todo) => ({ ...todo, id: nextDraftId++, selected: true })));
      setSource(data.source);
    } catch (error) {
      setGenerateError(error);
    } finally {
      setGenerating(false);
    }
  }

  function updateDraft(id: number, changes: Partial<Draft>) {
    setDrafts((current) => current?.map((d) => (d.id === id ? { ...d, ...changes } : d)) ?? null);
  }

  function toggleAll() {
    const selectAll = selected.length !== drafts?.length;
    setDrafts((current) => current?.map((d) => ({ ...d, selected: selectAll })) ?? null);
  }

  async function handleSave() {
    if (selected.length === 0 || hasEmptyTitle) return;
    setSaving(true);
    setSaveError('');
    try {
      await bulkCreateTodos(
        projectId,
        selected.map(({ title, description, type, priority, storyPoints }) => ({
          title: title.trim(),
          description,
          type,
          priority,
          storyPoints,
        })),
      );
      await refreshProjectData(queryClient, projectId);
      toast.showSuccess(t('gen.added', { todos: t('common.todos', { count: selected.length }) }));
      onClose();
      const backlogPath = `/projects/${projectId}/backlog`;
      if (location.pathname !== backlogPath) navigate(backlogPath);
    } catch (error) {
      setSaveError(getErrorMessage(error));
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    if (drafts && drafts.length > 0 && !window.confirm(t('gen.discard'))) return;
    onClose();
  }

  return (
    <Modal title={t('gen.title')} onClose={handleClose} wide>
      <form onSubmit={handleGenerate} noValidate>
        <div className="modal-body">
          <label htmlFor="ai-prompt">{t('gen.describe')}</label>
          <textarea
            id="ai-prompt"
            className="input"
            rows={3}
            maxLength={2000}
            placeholder={t('gen.placeholder')}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              // Ctrl/Cmd+Enter generates from the textarea.
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleGenerate();
            }}
            aria-invalid={promptError !== ''}
            aria-describedby={promptError ? 'ai-prompt-error' : undefined}
            autoFocus
          />
          {promptError && (
            <p id="ai-prompt-error" className="field-error">
              {promptError}
            </p>
          )}

          <div className="ai-form-row">
            <label htmlFor="ai-count" className="inline-label">
              {t('gen.howMany')}
              <select id="ai-count" className="input input-short" value={count} onChange={(event) => setCount(Number(event.target.value))}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">{t('gen.notSaved')}</p>
            <span className="spacer" />
            <button type="submit" className="button button-dark" disabled={busy}>
              {generating ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Icon name="sparkles" />}
              {generating ? t('gen.generating') : drafts ? t('gen.again') : t('gen.generate')}
            </button>
          </div>

          {generating && (
            <div className="ai-result">
              <AiThinking label={t('gen.writing')} />
              <div className="skeleton-list" aria-hidden="true">
                {Array.from({ length: Math.min(count, 5) }, (_, i) => (
                  <div key={i} className="skeleton skeleton-row" />
                ))}
              </div>
            </div>
          )}

          {!generating && Boolean(generateError) && (
            <div className="ai-result">
              <ErrorMessage error={generateError} onRetry={() => handleGenerate()} />
            </div>
          )}

          {!generating && drafts && (
            <div className="ai-result">
              <div className="ai-result-head">
                <h3>{t('gen.suggested', { count: drafts.length })}</h3>
                <MockBadge source={source} />
                <span className="spacer" />
                {drafts.length > 0 && (
                  <button type="button" className="link-button" onClick={toggleAll}>
                    {selected.length === drafts.length ? t('gen.selectNone') : t('gen.selectAll')}
                  </button>
                )}
              </div>

              {drafts.length === 0 ? (
                <p className="section-empty">{t('gen.noneBack')}</p>
              ) : (
                <ul className="draft-list">
                  <li className="draft-row draft-head" aria-hidden="true">
                    <span />
                    <span>{t('gen.colTitle')}</span>
                    <span>{t('gen.colType')}</span>
                    <span>{t('gen.colPriority')}</span>
                    <span>{t('gen.colPoints')}</span>
                  </li>
                  {drafts.map((draft, index) => (
                    <li key={draft.id} className={draft.selected ? 'draft-row' : 'draft-row draft-off'}>
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        onChange={(event) => updateDraft(draft.id, { selected: event.target.checked })}
                        aria-label={t('gen.keep', { n: index + 1 })}
                      />
                      <div className="draft-title">
                        <input
                          className="input"
                          value={draft.title}
                          maxLength={200}
                          onChange={(event) => updateDraft(draft.id, { title: event.target.value })}
                          aria-label={t('gen.titleOf', { n: index + 1 })}
                          aria-invalid={draft.selected && !draft.title.trim()}
                        />
                        {draft.description && <small className="muted draft-description">{draft.description}</small>}
                      </div>
                      <select
                        className="input"
                        value={draft.type}
                        onChange={(event) => updateDraft(draft.id, { type: event.target.value as TodoType })}
                        aria-label={t('gen.typeOf', { n: index + 1 })}
                      >
                        {TODO_TYPES.map((option) => (
                          <option key={option} value={option}>
                            {typeLabel(option)}
                          </option>
                        ))}
                      </select>
                      <select
                        className="input"
                        value={draft.priority}
                        onChange={(event) => updateDraft(draft.id, { priority: event.target.value })}
                        aria-label={t('gen.priorityOf', { n: index + 1 })}
                      >
                        {[...workflow.priorities].reverse().map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="input"
                        value={draft.storyPoints ?? ''}
                        onChange={(event) =>
                          updateDraft(draft.id, {
                            storyPoints: event.target.value === '' ? null : (Number(event.target.value) as StoryPoints),
                          })
                        }
                        aria-label={t('gen.pointsOf', { n: index + 1 })}
                      >
                        <option value="">–</option>
                        {STORY_POINTS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
              {hasEmptyTitle && <p className="field-error">{t('gen.needTitle')}</p>}
            </div>
          )}
          {saveError && <p className="error-box">{saveError}</p>}
        </div>
      </form>

      <div className="modal-footer">
        <div className="footer-info">
          {drafts && drafts.length > 0 && <span className="muted">{t('gen.ptsSelected', { n: selectedPoints })}</span>}
          <AiDisclaimer />
        </div>
        <button type="button" className="button" onClick={handleClose} disabled={saving}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={handleSave}
          disabled={busy || selected.length === 0 || hasEmptyTitle}
        >
          {saving ? t('gen.adding') : t('gen.add', { n: selected.length })}
        </button>
      </div>
    </Modal>
  );
}
