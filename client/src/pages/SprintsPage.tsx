import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { EmptyState, ErrorMessage, Loading } from '../components/States';
import Icon from '../components/Icon';
import TodoBadges from '../components/TodoBadges';
import SprintSummaryCard from '../components/SprintSummaryCard';
import TodoDetailsModal from '../components/TodoDetailsModal';
import { useI18n } from '../context/I18nContext';
import { useSprints, useTodos } from '../hooks/useProjectData';
import type { Sprint, Todo } from '../types/api';
import { formatDate, formatDateRange } from '../utils/format';
import { useWorkflow } from '../hooks/useWorkflow';
import { sprintStatusLabel } from '../utils/labels';

// For a completed sprint use the saved final numbers, otherwise the live ones.
function getStats(sprint: Sprint) {
  return sprint.completedStats ?? { ...sprint.stats, carriedOver: null };
}

export default function SprintsPage() {
  const { projectId = '', sprintId } = useParams();
  const todosQuery = useTodos(projectId);
  const sprintsQuery = useSprints(projectId);
  const workflow = useWorkflow(projectId);
  const [openTodo, setOpenTodo] = useState<Todo | null>(null);
  const { t } = useI18n();

  if (todosQuery.isPending || sprintsQuery.isPending) return <Loading />;
  if (todosQuery.isError) return <ErrorMessage error={todosQuery.error} onRetry={() => todosQuery.refetch()} />;
  if (sprintsQuery.isError) return <ErrorMessage error={sprintsQuery.error} onRetry={() => sprintsQuery.refetch()} />;

  const sprints = sprintsQuery.data;

  if (sprints.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1>{t('sprints.title')}</h1>
        </div>
        <EmptyState title={t('sprints.emptyTitle')} text={t('sprints.emptyText')} icon="sprints">
          <Link to={`/projects/${projectId}/backlog`} className="button button-primary">
            {t('common.goToBacklog')}
          </Link>
        </EmptyState>
      </>
    );
  }

  // No sprint in the URL? Show the first one.
  const selected = sprints.find((s) => s.id === sprintId) ?? sprints[0];
  const stats = getStats(selected);
  const percent = stats.totalPoints > 0 ? Math.round((stats.donePoints / stats.totalPoints) * 100) : 0;
  const selectedTodos = todosQuery.data.filter((todo) => todo.sprintId === selected.id);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('sprints.title')}</h1>
          <p className="page-subtitle">{t('sprints.subtitle', { count: sprints.length })}</p>
        </div>
      </div>

      <div className="sprints-layout">
        <ul className="sprint-list">
          {sprints.map((sprint) => {
            const sprintStats = getStats(sprint);
            return (
              <li key={sprint.id}>
                <Link
                  to={`/projects/${projectId}/sprints/${sprint.id}`}
                  className={sprint.id === selected.id ? 'card sprint-item selected' : 'card sprint-item'}
                >
                  <strong>{sprint.name}</strong>
                  <span className={`status-badge status-${sprint.status}`}>{sprintStatusLabel(sprint.status)}</span>
                  <small className="muted">{formatDateRange(sprint.startDate, sprint.endDate)}</small>
                  <small className="muted">
                    {t('common.pts', { n: `${sprintStats.donePoints}/${sprintStats.totalPoints}` })}
                  </small>
                  <span className="mini-progress" aria-hidden="true">
                    <span
                      style={{
                        width: `${sprintStats.totalPoints > 0 ? Math.round((sprintStats.donePoints / sprintStats.totalPoints) * 100) : 0}%`,
                      }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="card sprint-details">
          <div className="sprint-details-head">
            <h2>{selected.name}</h2>
            <span className={`status-badge status-${selected.status}`}>{sprintStatusLabel(selected.status)}</span>
            <span className="spacer" />
            {selected.status === 'active' && (
              <Link to={`/projects/${projectId}/board`} className="button button-small">
                {t('common.openBoard')}
                <Icon name="arrowRight" size={14} />
              </Link>
            )}
          </div>
          <p className="muted with-icon">
            <Icon name="calendar" size={14} />
            {formatDateRange(selected.startDate, selected.endDate)}
            {selected.completedAt && t('sprints.completedOn', { date: formatDate(selected.completedAt) })}
          </p>
          {selected.goal && (
            <p className="sprint-goal">
              <Icon name="target" size={14} />
              {selected.goal}
            </p>
          )}

          <div className="stats">
            <div className="stat">
              <small>{t('sprints.completedTodos')}</small>
              <strong>
                {stats.doneTodos} / {stats.totalTodos}
              </strong>
            </div>
            <div className="stat">
              <small>{t('sprints.pointsDone')}</small>
              <strong>
                {stats.donePoints} / {stats.totalPoints}
              </strong>
            </div>
            <div className="stat">
              <small>{t('sprints.carriedOver')}</small>
              <strong>{stats.carriedOver === null ? '–' : t('common.todos', { count: stats.carriedOver })}</strong>
            </div>
            <div className="stat">
              <small>{t('sprints.completion')}</small>
              <strong>{percent}%</strong>
            </div>
          </div>

          <SprintSummaryCard key={selected.id} sprint={selected} />

          <h3>{t('sprints.todos')}</h3>
          {selectedTodos.length === 0 ? (
            <p className="muted">{t('sprints.noTodos')}</p>
          ) : (
            <ul className="simple-list">
              {selectedTodos.map((todo) => (
                <li key={todo.id}>
                  <span className={`status-text tone-${workflow.status(todo.status).color}`}>
                    <span className="column-dot" aria-hidden="true" />
                    {workflow.status(todo.status).label}
                  </span>
                  <span className="todo-key">{todo.key}</span>
                  <button type="button" className="todo-title" onClick={() => setOpenTodo(todo)}>
                    {todo.title}
                  </button>
                  <TodoBadges todo={todo} />
                </li>
              ))}
            </ul>
          )}

        </div>
      </div>

      {openTodo && <TodoDetailsModal todo={openTodo} sprints={sprints} onClose={() => setOpenTodo(null)} />}
    </>
  );
}
