import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { planSprint } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { createSprint } from '../api/sprints';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { refreshProjectData, useTodos } from '../hooks/useProjectData';
import type { PlanSprintResponse, Todo } from '../types/api';
import { byOrder, sumPoints } from '../utils/format';
import { AiDisclaimer, AiThinking, MockBadge } from './AiBits';
import Icon from './Icon';
import Modal from './Modal';
import { ErrorMessage, Loading } from './States';

interface Props {
  projectId: string;
  onClose: () => void;
}

export default function PlanSprintModal({ projectId, onClose }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const todosQuery = useTodos(projectId);

  const [capacity, setCapacity] = useState('20');
  const [focus, setFocus] = useState('');
  const [capacityError, setCapacityError] = useState('');
  const [plan, setPlan] = useState<PlanSprintResponse | null>(null);
  const [goal, setGoal] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const backlog = (todosQuery.data ?? []).filter((todo) => todo.sprintId === null).sort(byOrder);
  const byId = new Map(backlog.map((todo) => [todo.id, todo]));

  // The suggested todos first (in the AI's order), then the rest of the backlog to pick from.
  const suggested = plan ? plan.todoIds.map((id) => byId.get(id)).filter((todo): todo is Todo => todo !== undefined) : [];
  const others = plan ? backlog.filter((todo) => !plan.todoIds.includes(todo.id)) : [];
  const rows = [...suggested, ...others];
  const selectedTodos = rows.filter((todo) => selectedIds.includes(todo.id));
  const selectedPoints = sumPoints(selectedTodos);
  const capacityNumber = plan ? Number(capacity) || 0 : 0;
  const percent = capacityNumber > 0 ? Math.min(100, Math.round((selectedPoints / capacityNumber) * 100)) : 0;
  const overBy = selectedPoints - capacityNumber;

  async function handlePlan(event?: FormEvent) {
    event?.preventDefault();
    const value = Number(capacity);
    if (!Number.isInteger(value) || value < 1 || value > 200) {
      setCapacityError(t('plan.capacityError'));
      return;
    }
    setCapacityError('');
    setPlanError(null);
    setPlanning(true);
    try {
      // Make sure the backlog we show matches what the AI saw.
      await todosQuery.refetch();
      const data = await planSprint(projectId, { capacity: value, focus: focus.trim() || undefined });
      setPlan(data);
      setGoal(data.goal);
      setSelectedIds(data.todoIds);
    } catch (error) {
      setPlanError(error);
    } finally {
      setPlanning(false);
    }
  }

  function toggle(id: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, id] : current.filter((x) => x !== id)));
  }

  async function handleCreate() {
    if (selectedTodos.length === 0) return;
    setCreating(true);
    setCreateError('');
    try {
      const sprint = await createSprint(projectId, { goal: goal.trim(), todoIds: selectedTodos.map((todo) => todo.id) });
      await refreshProjectData(queryClient, projectId);
      toast.showSuccess(t('plan.created', { name: sprint.name, todos: t('common.todos', { count: selectedTodos.length }) }));
      onClose();
      const backlogPath = `/projects/${projectId}/backlog`;
      if (location.pathname !== backlogPath) navigate(backlogPath);
    } catch (error) {
      setCreateError(getErrorMessage(error));
      setCreating(false);
    }
  }

  function handleClose() {
    if (creating) return;
    onClose();
  }

  function renderBody() {
    if (todosQuery.isPending) return <Loading />;
    if (todosQuery.isError) return <ErrorMessage error={todosQuery.error} onRetry={() => todosQuery.refetch()} />;
    if (backlog.length === 0 && !plan) {
      return (
        <p className="info-box">
          <Icon name="alert" />
          {t('plan.empty')}
        </p>
      );
    }
    if (planning) {
      return (
        <div className="ai-result">
          <AiThinking label={t('plan.planning')} />
          <div className="skeleton-list" aria-hidden="true">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        </div>
      );
    }
    return (
      <>
        {Boolean(planError) && (
          <div className="ai-result">
            <ErrorMessage error={planError} onRetry={() => handlePlan()} />
          </div>
        )}
        {plan && (
          <div className="ai-result">
            <label htmlFor="plan-goal">
              {t('plan.goal')} <MockBadge source={plan.source} />
            </label>
            <input id="plan-goal" className="input" maxLength={300} value={goal} onChange={(event) => setGoal(event.target.value)} />

            <div className="plan-grid">
              <div>
                <h3 className="plan-heading">{t('plan.backlogTodos')}</h3>
                {rows.length === 0 ? (
                  <p className="section-empty">{t('plan.noBacklog')}</p>
                ) : (
                  <ul className="plan-list">
                    {rows.map((todo, index) => (
                      <li key={todo.id} className={index === suggested.length && index > 0 ? 'plan-row plan-row-divider' : 'plan-row'}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(todo.id)}
                            onChange={(event) => toggle(todo.id, event.target.checked)}
                          />
                          <span className="todo-key">{todo.key}</span>
                          <span className="plan-title">{todo.title}</span>
                          <span className="points" title={t('common.storyPoints')}>
                            {todo.storyPoints ?? '–'}
                            <span className="sr-only">{t('common.storyPointsSr')}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <div className={overBy > 0 ? 'plan-total plan-total-over' : 'plan-total'}>
                  <span>{t('plan.total')}</span>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label={t('plan.totalLabel')}
                    aria-valuenow={selectedPoints}
                    aria-valuemin={0}
                    aria-valuemax={capacityNumber}
                  >
                    <div className="progress-bar" style={{ width: `${percent}%` }} />
                  </div>
                  <strong>{t('common.pts', { n: `${selectedPoints} / ${capacityNumber}` })}</strong>
                </div>
                {overBy > 0 && (
                  <p className="field-error">
                    <Icon name="alert" size={14} /> {t('plan.over', { n: overBy })}
                  </p>
                )}
              </div>

              <div className="plan-reasoning">
                <h3 className="plan-heading">{t('plan.why')}</h3>
                <p>{plan.reasoning || t('plan.noReason')}</p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <Modal title={t('plan.title')} onClose={handleClose} wide>
      <form onSubmit={handlePlan} noValidate>
        <div className="modal-body">
          <div className="plan-form">
            <div>
              <label htmlFor="plan-capacity">{t('plan.capacity')}</label>
              <input
                id="plan-capacity"
                className="input"
                type="number"
                min={1}
                max={200}
                required
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                aria-invalid={capacityError !== ''}
                aria-describedby={capacityError ? 'plan-capacity-error' : undefined}
                autoFocus
              />
            </div>
            <div className="plan-focus">
              <label htmlFor="plan-focus">{t('plan.focus')}</label>
              <input
                id="plan-focus"
                className="input"
                maxLength={300}
                placeholder={t('plan.focusPlaceholder')}
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
              />
            </div>
            <button
              type="submit"
              className="button button-dark"
              disabled={planning || creating || todosQuery.isPending || (backlog.length === 0 && !plan)}
            >
              {planning ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Icon name="sparkles" />}
              {planning ? t('plan.planningShort') : plan ? t('plan.again') : t('plan.suggest')}
            </button>
          </div>
          {capacityError && (
            <p id="plan-capacity-error" className="field-error">
              {capacityError}
            </p>
          )}

          {renderBody()}
          {createError && <p className="error-box">{createError}</p>}
        </div>
      </form>

      <div className="modal-footer">
        <div className="footer-info">
          <AiDisclaimer />
        </div>
        <button type="button" className="button" onClick={handleClose} disabled={creating}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={handleCreate}
          disabled={!plan || planning || creating || selectedTodos.length === 0}
        >
          {creating ? t('plan.creating') : t('plan.create', { todos: t('common.todos', { count: selectedTodos.length }) })}
        </button>
      </div>
    </Modal>
  );
}
