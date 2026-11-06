import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getErrorMessage, getFieldErrors } from '../api/client';
import { deleteTodo, updateTodo } from '../api/todos';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { refreshProjectData } from '../hooks/useProjectData';
import { useWorkflow } from '../hooks/useWorkflow';
import { STORY_POINTS, TODO_TYPES } from '../types/api';
import type { Sprint, StoryPoints, Todo, TodoType } from '../types/api';
import { formatDate } from '../utils/format';
import { sprintStatusLabel, typeLabel } from '../utils/labels';
import Modal from './Modal';

interface Props {
  todo: Todo;
  sprints: Sprint[];
  onClose: () => void;
}

export default function TodoDetailsModal({ todo, sprints, onClose }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const workflow = useWorkflow(todo.projectId);

  // All form fields are strings, like the <input>s. We convert them when saving.
  const startValues = {
    title: todo.title,
    description: todo.description,
    status: todo.status as string,
    priority: todo.priority as string,
    type: todo.type as string,
    storyPoints: todo.storyPoints === null ? '' : String(todo.storyPoints),
    sprintId: todo.sprintId ?? '',
    labels: todo.labels.join(', '),
    dueDate: todo.dueDate ?? '',
  };
  const [form, setForm] = useState(startValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(startValues);

  // A todo in a completed sprint stays there as history.
  const currentSprint = sprints.find((s) => s.id === todo.sprintId);
  const isInCompletedSprint = currentSprint?.status === 'completed';
  const openSprints = sprints.filter((s) => s.status !== 'completed');

  function updateField(field: keyof typeof form, value: string) {
    setForm({ ...form, [field]: value });
  }

  function handleClose() {
    if (hasChanges && !window.confirm(t('todo.discard'))) return;
    onClose();
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) {
      setErrors({ title: t('todo.titleRequired') });
      return;
    }

    setSaving(true);
    try {
      await updateTodo(todo.id, {
        title: form.title.trim(),
        description: form.description,
        status: form.status,
        priority: form.priority,
        type: form.type as TodoType,
        storyPoints: form.storyPoints ? (Number(form.storyPoints) as StoryPoints) : null,
        labels: form.labels
          .split(',')
          .map((label) => label.trim())
          .filter((label) => label !== ''),
        dueDate: form.dueDate || null,
        ...(isInCompletedSprint ? {} : { sprintId: form.sprintId || null }),
      });
      await refreshProjectData(queryClient, todo.projectId);
      toast.showSuccess(t('todo.saved', { key: todo.key }));
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setErrors(getFieldErrors(error));
      } else {
        setErrors({ form: getErrorMessage(error) });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('todo.confirmDelete', { key: todo.key, title: todo.title }))) return;
    try {
      await deleteTodo(todo.id);
      await refreshProjectData(queryClient, todo.projectId);
      toast.showSuccess(t('todo.deleted', { key: todo.key }));
      onClose();
    } catch (error) {
      setErrors({ form: getErrorMessage(error) });
    }
  }

  return (
    <Modal title={t('todo.modalTitle', { key: todo.key, date: formatDate(todo.createdAt) })} onClose={handleClose} wide>
      <form onSubmit={handleSave} noValidate>
        <div className="modal-body todo-form">
          {errors.form && <p className="error-box">{errors.form}</p>}

          <div className="todo-form-main">
            <label htmlFor="todo-title">{t('todo.title')}</label>
            <input id="todo-title" className="input" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
            {errors.title && <p className="field-error">{errors.title}</p>}

            <label htmlFor="todo-description">{t('todo.description')}</label>
            <textarea
              id="todo-description"
              className="input"
              rows={12}
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
            {errors.description && <p className="field-error">{errors.description}</p>}
          </div>

          <div className="todo-form-side">
            <label htmlFor="todo-status">{t('todo.status')}</label>
            <select id="todo-status" className="input" value={form.status} onChange={(e) => updateField('status', e.target.value)}>
              {workflow.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
            {errors.status && <p className="field-error">{errors.status}</p>}

            <label htmlFor="todo-priority">{t('todo.priority')}</label>
            <select id="todo-priority" className="input" value={form.priority} onChange={(e) => updateField('priority', e.target.value)}>
              {[...workflow.priorities].reverse().map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.label}
                </option>
              ))}
            </select>
            {errors.priority && <p className="field-error">{errors.priority}</p>}

            <label htmlFor="todo-type">{t('todo.type')}</label>
            <select id="todo-type" className="input" value={form.type} onChange={(e) => updateField('type', e.target.value)}>
              {TODO_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>

            <label htmlFor="todo-points">{t('todo.points')}</label>
            <select id="todo-points" className="input" value={form.storyPoints} onChange={(e) => updateField('storyPoints', e.target.value)}>
              <option value="">{t('todo.none')}</option>
              {STORY_POINTS.map((points) => (
                <option key={points} value={points}>
                  {points}
                </option>
              ))}
            </select>

            <label htmlFor="todo-sprint">{t('todo.sprint')}</label>
            <select
              id="todo-sprint"
              className="input"
              value={form.sprintId}
              disabled={isInCompletedSprint}
              onChange={(e) => updateField('sprintId', e.target.value)}
            >
              <option value="">{t('common.backlog')}</option>
              {isInCompletedSprint && <option value={currentSprint.id}>{currentSprint.name} ({sprintStatusLabel('completed')})</option>}
              {openSprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name} ({sprintStatusLabel(sprint.status)})
                </option>
              ))}
            </select>

            <label htmlFor="todo-labels">{t('todo.labels')}</label>
            <input
              id="todo-labels"
              className="input"
              placeholder="frontend, login"
              value={form.labels}
              onChange={(e) => updateField('labels', e.target.value)}
            />
            <p className="hint">{t('todo.labelsHint')}</p>
            {errors.labels && <p className="field-error">{errors.labels}</p>}

            <label htmlFor="todo-due">{t('todo.dueDate')}</label>
            <input id="todo-due" type="date" className="input" value={form.dueDate} onChange={(e) => updateField('dueDate', e.target.value)} />
            {errors.dueDate && <p className="field-error">{errors.dueDate}</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="button button-danger" onClick={handleDelete}>
            {t('common.delete')}
          </button>
          <span className="spacer" />
          <button type="button" className="button" onClick={handleClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
