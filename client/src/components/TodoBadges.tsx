import type { Todo } from '../types/api';
import { useI18n } from '../context/I18nContext';
import { useWorkflow } from '../hooks/useWorkflow';
import { priorityIcon, typeLabel } from '../utils/labels';

// Type, priority and points: used on backlog rows and board cards.
export default function TodoBadges({ todo }: { todo: Todo }) {
  const { t } = useI18n();
  const priority = useWorkflow(todo.projectId).priority(todo.priority);
  return (
    <span className="badges">
      <span className={`badge type-${todo.type}`}>
        <span className="type-icon" aria-hidden="true" />
        {typeLabel(todo.type)}
      </span>
      <span className={`badge priority-badge tone-${priority.color}`}>
        <span aria-hidden="true">{priorityIcon(priority.id)}</span>
        {priority.label}
      </span>
      <span className="points" title={t('common.storyPoints')}>{todo.storyPoints === null ? '–' : todo.storyPoints}
        <span className="sr-only">{t('common.storyPointsSr')}</span></span>
    </span>
  );
}
