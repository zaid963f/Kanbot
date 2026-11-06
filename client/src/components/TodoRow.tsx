import { useI18n } from '../context/I18nContext';
import type { Sprint, Todo } from '../types/api';
import Icon from './Icon';
import TodoBadges from './TodoBadges';

interface Props {
  todo: Todo;
  moveTargets: Sprint[]; // sprints this todo can be moved to
  canDrag: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveTo: (sprintId: string | null) => void;
  showMoveButtons: boolean; // ↑ ↓ buttons, only in the backlog list
  onMoveUp?: () => void; // undefined = already at the top
  onMoveDown?: () => void; // undefined = already at the bottom
}

// One todo in the backlog or in a planned sprint list.
export default function TodoRow(props: Props) {
  const { todo, moveTargets, canDrag } = props;
  const { t } = useI18n();

  return (
    <li
      className="todo-row"
      draggable={canDrag}
      onDragStart={props.onDragStart}
      onDragOver={(event) => event.preventDefault()} // needed so we can drop here
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation(); // don't also trigger the drop of the whole section
        props.onDrop();
      }}
    >
      <span className="drag-handle" title={canDrag ? t('row.drag') : t('row.clearFilters')}>
        <Icon name="grip" size={14} />
      </span>
      <span className="todo-key">{todo.key}</span>
      <button type="button" className="todo-title" onClick={props.onOpen}>
        {todo.title}
      </button>
      {todo.labels.length > 0 && (
        <span className="labels">
          {todo.labels.map((label) => (
            <span key={label} className="label-chip">
              {label}
            </span>
          ))}
        </span>
      )}
      <TodoBadges todo={todo} />

      {props.showMoveButtons && (
        <span className="row-buttons">
          <button
            type="button"
            className="icon-button"
            onClick={props.onMoveUp}
            disabled={!canDrag || !props.onMoveUp}
            aria-label={t('row.moveUp', { key: todo.key })}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={props.onMoveDown}
            disabled={!canDrag || !props.onMoveDown}
            aria-label={t('row.moveDown', { key: todo.key })}
          >
            ↓
          </button>
        </span>
      )}

      <select
        className="move-select"
        value=""
        aria-label={t('row.moveToLabel', { key: todo.key })}
        onChange={(event) => props.onMoveTo(event.target.value === 'backlog' ? null : event.target.value)}
      >
        <option value="" disabled>
          {t('row.moveTo')}
        </option>
        {todo.sprintId !== null && <option value="backlog">{t('common.backlog')}</option>}
        {moveTargets
          .filter((sprint) => sprint.id !== todo.sprintId)
          .map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.status === 'active' ? t('row.active', { name: sprint.name }) : sprint.name}
            </option>
          ))}
      </select>
    </li>
  );
}
