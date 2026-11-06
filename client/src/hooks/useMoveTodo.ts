import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moveTodo } from '../api/todos';
import { useToast } from '../context/ToastContext';
import type { Todo, TodoStatus } from '../types/api';
import { byOrder } from '../utils/format';
import { refreshProjectData } from './useProjectData';

interface MoveData {
  todo: Todo;
  sprintId: string | null; // null = backlog
  status: TodoStatus;
  position: number; // place in the new list (0 = top)
}

// Moves the todo inside our cached list, the same way the server will do it.
// A "list" is the backlog, or one status column of one sprint.
function moveInList(todos: Todo[], { todo, sprintId, status, position }: MoveData) {
  const movedTodo = { ...todo, sprintId, status };
  const isInTargetList = (t: Todo) => t.sprintId === sprintId && (sprintId === null || t.status === status);

  const others = todos.filter((t) => t.id !== todo.id);
  const targetList = others.filter(isInTargetList).sort(byOrder);
  targetList.splice(position, 0, movedTodo);

  const renumbered = targetList.map((t, index) => ({ ...t, order: index }));
  return [...others.filter((t) => !isInTargetList(t)), ...renumbered];
}

// Used by drag and drop. The screen updates right away (optimistic update)
// and goes back to the old order if the server returns an error.
export function useMoveTodo(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: MoveData) =>
      moveTodo(data.todo.id, { sprintId: data.sprintId, status: data.status, position: data.position }),

    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['todos', projectId] });
      const oldTodos = queryClient.getQueryData<Todo[]>(['todos', projectId]);
      if (oldTodos) {
        queryClient.setQueryData(['todos', projectId], moveInList(oldTodos, data));
      }
      return { oldTodos };
    },

    onError: (error, _data, context) => {
      if (context?.oldTodos) {
        queryClient.setQueryData(['todos', projectId], context.oldTodos);
      }
      toast.showError('Could not move the todo: ' + error.message);
    },

    onSettled: () => refreshProjectData(queryClient, projectId),
  });
}
