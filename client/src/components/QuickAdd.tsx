import { useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../api/client';
import { createTodo } from '../api/todos';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import Icon from './Icon';
import { refreshProjectData } from '../hooks/useProjectData';

// Type a title and press Enter to add a todo to the backlog. Escape clears it.
export default function QuickAdd({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [title, setTitle] = useState('');

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setTitle('');
      event.currentTarget.blur();
      return;
    }
    if (event.key !== 'Enter' || !title.trim()) return;

    const newTitle = title.trim();
    setTitle(''); // clear right away so the user can type the next one
    try {
      const todo = await createTodo(projectId, { title: newTitle });
      await refreshProjectData(queryClient, projectId);
      toast.showSuccess(t('quickAdd.created', { key: todo.key }));
    } catch (error) {
      setTitle(newTitle);
      toast.showError(getErrorMessage(error));
    }
  }

  return (
    <div className="quick-add">
      <Icon name="plus" />
      <label htmlFor="quick-add" className="sr-only">
        {t('quickAdd.label')}
      </label>
      <input
        id="quick-add"
        placeholder={t('quickAdd.placeholder')}
        maxLength={200}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
