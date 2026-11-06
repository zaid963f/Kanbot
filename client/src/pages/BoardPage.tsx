import { useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import CompleteSprintModal from '../components/CompleteSprintModal';
import { EmptyState, ErrorMessage, Loading } from '../components/States';
import Icon from '../components/Icon';
import TodoBadges from '../components/TodoBadges';
import SprintSummaryCard from '../components/SprintSummaryCard';
import TodoDetailsModal from '../components/TodoDetailsModal';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useMoveTodo } from '../hooks/useMoveTodo';
import { refreshProjectData, useSprints, useTodos } from '../hooks/useProjectData';
import { useWorkflow } from '../hooks/useWorkflow';
import WorkflowSettingsModal from '../components/WorkflowSettingsModal';
import { DONE_STATUS } from '../types/api';
import type { Todo, TodoStatus } from '../types/api';
import { byOrder, daysLeft, formatDateRange, sumPoints } from '../utils/format';

export default function BoardPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const todosQuery = useTodos(projectId);
  const sprintsQuery = useSprints(projectId);
  const moveTodo = useMoveTodo(projectId);
  const workflow = useWorkflow(projectId);

  const [openTodo, setOpenTodo] = useState<Todo | null>(null);
  const [draggedTodo, setDraggedTodo] = useState<Todo | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);

  if (todosQuery.isPending || sprintsQuery.isPending) return <Loading />;
  if (todosQuery.isError) return <ErrorMessage error={todosQuery.error} onRetry={() => todosQuery.refetch()} />;
  if (sprintsQuery.isError) return <ErrorMessage error={sprintsQuery.error} onRetry={() => sprintsQuery.refetch()} />;

  const sprints = sprintsQuery.data;
  const sprint = sprints.find((s) => s.status === 'active');

  if (!sprint) {
    return (
      <>
        <div className="page-header">
          <h1>{t('board.title')}</h1>
        </div>
        <EmptyState title={t('board.emptyTitle')} text={t('board.emptyText')} icon="board">
          <Link to={`/projects/${projectId}/backlog`} className="button button-primary">
            {t('common.goToBacklog')}
          </Link>
        </EmptyState>
      </>
    );
  }

  const sprintTodos = todosQuery.data.filter((todo) => todo.sprintId === sprint.id);
  const doneTodos = sprintTodos.filter((todo) => todo.status === DONE_STATUS);
  const totalPoints = sumPoints(sprintTodos);
  const donePoints = sumPoints(doneTodos);
  const percent = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  function getColumn(status: TodoStatus) {
    return sprintTodos.filter((todo) => todo.status === status).sort(byOrder);
  }

  // Drop on a card: take its place. Drop on the empty part of a column (targetTodo = null): go to the bottom.
  function handleDrop(status: TodoStatus, targetTodo: Todo | null) {
    const todo = draggedTodo;
    setDraggedTodo(null);
    if (!todo || !sprint || todo.id === targetTodo?.id) return;

    const column = getColumn(status);
    const others = column.filter((t) => t.id !== todo.id);
    let position = targetTodo ? others.findIndex((t) => t.id === targetTodo.id) : others.length;
    // Dragging down inside the same column: put it below the target.
    const oldIndex = column.findIndex((t) => t.id === todo.id);
    const targetIndex = column.findIndex((t) => t.id === targetTodo?.id);
    if (oldIndex !== -1 && targetIndex !== -1 && oldIndex < targetIndex) position += 1;

    moveTodo.mutate({ todo, sprintId: sprint.id, status, position });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{sprint.name}</h1>
          <p className="page-subtitle with-icon">
            <Icon name="calendar" size={14} />
            {formatDateRange(sprint.startDate, sprint.endDate)} · {daysLeft(sprint.endDate)}
          </p>
        </div>
        <span className="spacer" />
        <button type="button" className="button" onClick={() => setShowWorkflow(true)}>
          <Icon name="edit" />
          {t('workflow.editColumns')}
        </button>
        <button type="button" className="button button-primary" onClick={() => setShowComplete(true)}>
          <Icon name="check" />
          {t('board.complete')}
        </button>
      </div>

      <div className="card sprint-info">
        <div className="sprint-info-goal">
          <small>{t('board.goal')}</small>
          <p>{sprint.goal || <span className="muted">{t('board.noGoal')}</span>}</p>
        </div>
        <div className="sprint-info-progress">
          <div className="progress-head">
            <small>{t('board.progress')}</small>
            <strong>{percent}%</strong>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('board.progressLabel')}>
            <div className="progress-bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="muted">
            {t('board.progressText', { done: donePoints, total: totalPoints, doneTodos: doneTodos.length, totalTodos: sprintTodos.length })}
          </p>
        </div>
      </div>

      <SprintSummaryCard key={sprint.id} sprint={sprint} collapsible />

      <p className="hint board-hint">{t('board.hint')}</p>

      <div className="board" style={{ '--columns': workflow.statuses.length } as CSSProperties}>
        {workflow.statuses.map(({ id: status, label, color }) => {
          const column = getColumn(status);
          return (
            <section
              key={status}
              className={`column tone-${color}${status === DONE_STATUS ? ' column-done' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(status, null)}
            >
              <h3>
                <span className="column-dot" aria-hidden="true" />
                {label}
                <span className="count">{column.length}</span>
              </h3>
              {column.map((todo) => (
                <div
                  key={todo.id}
                  className="todo-card"
                  draggable
                  onDragStart={() => setDraggedTodo(todo)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDrop(status, todo);
                  }}
                >
                  <button type="button" className="todo-title" onClick={() => setOpenTodo(todo)}>
                    {todo.title}
                  </button>
                  <div className="todo-card-footer">
                    <span className="todo-key">{todo.key}</span>
                    <TodoBadges todo={todo} />
                  </div>
                </div>
              ))}
              {column.length === 0 && <p className="column-empty">{t('board.dropHere')}</p>}
            </section>
          );
        })}
      </div>

      {showWorkflow && <WorkflowSettingsModal projectId={projectId} initialTab="statuses" onClose={() => setShowWorkflow(false)} />}

      {openTodo && <TodoDetailsModal todo={openTodo} sprints={sprints} onClose={() => setOpenTodo(null)} />}

      {showComplete && (
        <CompleteSprintModal
          sprint={sprint}
          sprintTodos={sprintTodos}
          plannedSprints={sprints.filter((s) => s.status === 'planned')}
          onClose={() => setShowComplete(false)}
          onCompleted={() => {
            toast.showSuccess(t('board.completed', { name: sprint.name }));
            navigate(`/projects/${projectId}/sprints/${sprint.id}`);
            refreshProjectData(queryClient, projectId);
          }}
        />
      )}
    </>
  );
}
