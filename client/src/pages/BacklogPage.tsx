import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { getErrorMessage } from '../api/client';
import { deleteSprint } from '../api/sprints';
import Icon from '../components/Icon';
import QuickAdd from '../components/QuickAdd';
import SprintFormModal from '../components/SprintFormModal';
import StartSprintModal from '../components/StartSprintModal';
import { EmptyState, ErrorMessage, Loading } from '../components/States';
import TodoDetailsModal from '../components/TodoDetailsModal';
import TodoRow from '../components/TodoRow';
import { useAi } from '../context/AiContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useMoveTodo } from '../hooks/useMoveTodo';
import { refreshProjectData, useSprints, useTodos } from '../hooks/useProjectData';
import { useWorkflow } from '../hooks/useWorkflow';
import WorkflowSettingsModal from '../components/WorkflowSettingsModal';
import { TODO_TYPES } from '../types/api';
import type { Sprint, Todo } from '../types/api';
import { byOrder, formatDateRange, sumPoints } from '../utils/format';
import { typeLabel } from '../utils/labels';

export default function BacklogPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const todosQuery = useTodos(projectId);
  const sprintsQuery = useSprints(projectId);
  const moveTodo = useMoveTodo(projectId);
  const workflow = useWorkflow(projectId);
  const ai = useAi();
  const { t } = useI18n();

  // filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');

  // modals
  const [openTodo, setOpenTodo] = useState<Todo | null>(null);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [startingSprint, setStartingSprint] = useState<Sprint | null>(null);
  const [showWorkflow, setShowWorkflow] = useState(false);

  const [draggedTodo, setDraggedTodo] = useState<Todo | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Wait 300ms after the user stops typing before filtering.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (todosQuery.isPending || sprintsQuery.isPending) return <Loading />;
  if (todosQuery.isError) return <ErrorMessage error={todosQuery.error} onRetry={() => todosQuery.refetch()} />;
  if (sprintsQuery.isError) return <ErrorMessage error={sprintsQuery.error} onRetry={() => sprintsQuery.refetch()} />;

  const todos = todosQuery.data;
  const sprints = sprintsQuery.data;
  const activeSprint = sprints.find((sprint) => sprint.status === 'active');
  const plannedSprints = sprints.filter((sprint) => sprint.status === 'planned');
  const moveTargets = sprints.filter((sprint) => sprint.status !== 'completed');

  const backlogTodos = todos.filter((todo) => todo.sprintId === null).sort(byOrder);
  const isFiltering = debouncedSearch !== '' || priority !== '' || type !== '';
  const visibleBacklog = backlogTodos.filter((todo) => {
    const text = `${todo.key} ${todo.title} ${todo.description} ${todo.labels.join(' ')}`.toLowerCase();
    if (debouncedSearch && !text.includes(debouncedSearch)) return false;
    if (priority && todo.priority !== priority) return false;
    if (type && todo.type !== type) return false;
    return true;
  });

  // Todos of one sprint, sorted by status column and then by order.
  function getSprintTodos(sprintId: string) {
    const rank = (status: string) => workflow.statuses.findIndex((s) => s.id === status);
    return todos
      .filter((todo) => todo.sprintId === sprintId)
      .sort((a, b) => rank(a.status) - rank(b.status) || a.order - b.order);
  }

  // Move `todo` so it ends up at `index` in `list` (list = backlog, or a sprint's todos).
  function moveToIndex(todo: Todo, sprintId: string | null, list: Todo[], index: number) {
    const others = list.filter((t) => t.id !== todo.id);
    let position = index;
    // In a sprint, the server keeps one order per status column, so count only the same status.
    if (sprintId !== null) {
      position = others.slice(0, index).filter((t) => t.status === todo.status).length;
    }
    moveTodo.mutate({ todo, sprintId, status: todo.status, position });
  }

  // Drop on a todo: the dragged todo takes its place. Drop on a section (targetTodo = null): goes to the end.
  function handleDrop(sprintId: string | null, list: Todo[], targetTodo: Todo | null) {
    const todo = draggedTodo;
    setDraggedTodo(null);
    if (!todo || todo.id === targetTodo?.id) return;

    const others = list.filter((t) => t.id !== todo.id);
    let index = targetTodo ? others.findIndex((t) => t.id === targetTodo.id) : others.length;
    // When dragging down in the same list, put it below the target instead of above.
    const oldIndex = list.findIndex((t) => t.id === todo.id);
    const targetIndex = list.findIndex((t) => t.id === targetTodo?.id);
    if (oldIndex !== -1 && targetIndex !== -1 && oldIndex < targetIndex) index += 1;

    moveToIndex(todo, sprintId, list, index);
  }

  function handleMoveTo(todo: Todo, sprintId: string | null) {
    // 9999 = at the end (the server puts it at the end of the list if the number is too big)
    moveTodo.mutate({ todo, sprintId, status: todo.status, position: 9999 });
    const name = sprintId ? sprints.find((s) => s.id === sprintId)?.name : t('backlog.theBacklog');
    toast.showSuccess(t('backlog.movedTo', { key: todo.key, name: name ?? '' }));
  }

  async function handleDeleteSprint(sprint: Sprint) {
    if (!window.confirm(t('backlog.confirmDeleteSprint', { name: sprint.name }))) return;
    try {
      await deleteSprint(sprint.id);
      await refreshProjectData(queryClient, projectId);
      toast.showSuccess(t('backlog.sprintDeleted', { name: sprint.name }));
    } catch (error) {
      toast.showError(getErrorMessage(error));
    }
  }

  function renderRows(list: Todo[], sprintId: string | null) {
    return (
      <ul className="todo-list">
        {list.map((todo, index) => (
          <TodoRow
            key={todo.id}
            todo={todo}
            moveTargets={moveTargets}
            canDrag={!isFiltering}
            onOpen={() => setOpenTodo(todo)}
            onDragStart={() => setDraggedTodo(todo)}
            onDrop={() => handleDrop(sprintId, list, todo)}
            onMoveTo={(target) => handleMoveTo(todo, target)}
            showMoveButtons={sprintId === null}
            onMoveUp={sprintId === null && index > 0 ? () => moveToIndex(todo, null, list, index - 1) : undefined}
            onMoveDown={sprintId === null && index < list.length - 1 ? () => moveToIndex(todo, null, list, index + 1) : undefined}
          />
        ))}
      </ul>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('backlog.title')}</h1>
          <p className="page-subtitle">
            {t('backlog.subtitle', { todos: t('common.todos', { count: backlogTodos.length }), points: sumPoints(backlogTodos) })}
          </p>
        </div>
        <span className="spacer" />
        <button type="button" className="button button-ai" onClick={() => ai.openDialog({ type: 'generate' })}>
          <Icon name="sparkles" />
          {t('backlog.generate')}
        </button>
        <button
          type="button"
          className="button button-ai"
          onClick={() => ai.openDialog({ type: 'plan' })}
          disabled={backlogTodos.length === 0}
          title={backlogTodos.length === 0 ? t('backlog.addFirst') : ''}
        >
          <Icon name="sparkles" />
          {t('backlog.planAi')}
        </button>
        <button type="button" className="button" onClick={() => setShowCreateSprint(true)}>
          <Icon name="plus" />
          {t('backlog.createSprint')}
        </button>
      </div>

      <div className="filters">
        <div className="search-field">
          <Icon name="search" />
          <input
            className="input"
            type="search"
            placeholder={t('backlog.search')}
            aria-label={t('backlog.searchLabel')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input" aria-label={t('backlog.priority')} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">{t('backlog.allPriorities')}</option>
          {[...workflow.priorities].reverse().map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select className="input" aria-label={t('backlog.type')} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('backlog.allTypes')}</option>
          {TODO_TYPES.map((option) => (
            <option key={option} value={option}>
              {typeLabel(option)}
            </option>
          ))}
        </select>
        <button type="button" className="button" onClick={() => setShowWorkflow(true)}>
          <Icon name="edit" />
          {t('workflow.button')}
        </button>
      </div>

      {activeSprint && (
        <div className="info-box banner">
          <span className="pill pill-active">
            <span className="dot" />
            {t('backlog.live')}
          </span>
          <span>{t('backlog.inProgress', { name: activeSprint.name })}</span>
          <span className="spacer" />
          <Link to={`/projects/${projectId}/board`} className="button button-small">
            {t('common.openBoard')}
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      )}

      {/* Planned sprints */}
      {!isFiltering &&
        plannedSprints.map((sprint) => {
          const sprintTodos = getSprintTodos(sprint.id);
          const isCollapsed = collapsed[sprint.id];
          return (
            <section
              key={sprint.id}
              className="section sprint-section"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(sprint.id, sprintTodos, null)}
            >
              <div className="section-header">
                <button
                  type="button"
                  className="collapse-button"
                  aria-expanded={!isCollapsed}
                  onClick={() => setCollapsed({ ...collapsed, [sprint.id]: !isCollapsed })}
                >
                  <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} />
                  {sprint.name}
                </button>
                <span className="status-badge status-planned">{t('backlog.planned')}</span>
                <span className="muted">
                  {formatDateRange(sprint.startDate, sprint.endDate)} · {t('common.todos', { count: sprintTodos.length })} ·{' '}
                  {t('common.pts', { n: sumPoints(sprintTodos) })}
                </span>
                <span className="spacer" />
                <button
                  type="button"
                  className="icon-button ghost"
                  onClick={() => setEditingSprint(sprint)}
                  aria-label={t('common.editItem', { name: sprint.name })}
                  title={t('common.edit')}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-button ghost danger"
                  onClick={() => handleDeleteSprint(sprint)}
                  aria-label={t('common.deleteItem', { name: sprint.name })}
                  title={t('common.delete')}
                >
                  <Icon name="trash" />
                </button>
                <button
                  type="button"
                  className="button button-small button-dark"
                  disabled={activeSprint !== undefined}
                  title={activeSprint ? t('backlog.completeFirst', { name: activeSprint.name }) : ''}
                  onClick={() => setStartingSprint(sprint)}
                >
                  <Icon name="play" size={12} />
                  {t('backlog.startSprint')}
                </button>
              </div>
              {sprint.goal && (
                <p className="sprint-goal">
                  <Icon name="target" size={14} />
                  {sprint.goal}
                </p>
              )}
              {activeSprint && <p className="hint section-note">{t('backlog.startAfter', { name: activeSprint.name })}</p>}
              {!isCollapsed &&
                (sprintTodos.length > 0 ? (
                  renderRows(sprintTodos, sprint.id)
                ) : (
                  <p className="section-empty">{t('backlog.dragHere')}</p>
                ))}
            </section>
          );
        })}

      {/* The backlog itself */}
      <section
        className="section"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => !isFiltering && handleDrop(null, backlogTodos, null)}
      >
        <div className="section-header">
          <h2>{t('backlog.title')}</h2>
          <span className="muted">
            {t('common.todos', { count: visibleBacklog.length })} · {t('common.pts', { n: sumPoints(visibleBacklog) })}
          </span>
        </div>
        {isFiltering && <p className="hint section-note">{t('backlog.dragOff')}</p>}

        {backlogTodos.length === 0 ? (
          <EmptyState title={t('backlog.emptyTitle')} text={t('backlog.emptyText')}>
            <button type="button" className="button button-primary" onClick={() => document.getElementById('quick-add')?.focus()}>
              {t('backlog.createTodo')}
            </button>
            <button type="button" className="button button-ai" onClick={() => ai.openDialog({ type: 'generate' })}>
              <Icon name="sparkles" />
              {t('backlog.generateAi')}
            </button>
          </EmptyState>
        ) : visibleBacklog.length === 0 ? (
          <p className="section-empty">{t('backlog.noMatch')}</p>
        ) : (
          renderRows(isFiltering ? visibleBacklog : backlogTodos, null)
        )}

        <QuickAdd projectId={projectId} />
      </section>

      {showWorkflow && <WorkflowSettingsModal projectId={projectId} onClose={() => setShowWorkflow(false)} />}

      {openTodo && <TodoDetailsModal todo={openTodo} sprints={sprints} onClose={() => setOpenTodo(null)} />}

      {showCreateSprint && (
        <SprintFormModal
          projectId={projectId}
          onClose={() => setShowCreateSprint(false)}
          onSaved={() => {
            setShowCreateSprint(false);
            refreshProjectData(queryClient, projectId);
            toast.showSuccess(t('backlog.sprintCreated'));
          }}
        />
      )}

      {editingSprint && (
        <SprintFormModal
          projectId={projectId}
          sprint={editingSprint}
          onClose={() => setEditingSprint(null)}
          onSaved={() => {
            setEditingSprint(null);
            refreshProjectData(queryClient, projectId);
            toast.showSuccess(t('backlog.sprintSaved'));
          }}
        />
      )}

      {startingSprint && (
        <StartSprintModal
          sprint={startingSprint}
          onClose={() => setStartingSprint(null)}
          onStarted={() => {
            refreshProjectData(queryClient, projectId);
            toast.showSuccess(t('backlog.sprintStarted', { name: startingSprint.name }));
            navigate(`/projects/${projectId}/board`);
          }}
        />
      )}
    </>
  );
}
