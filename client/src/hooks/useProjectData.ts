import { useQuery, type QueryClient } from '@tanstack/react-query';
import { getProjects } from '../api/projects';
import { getSprints } from '../api/sprints';
import { getTodos } from '../api/todos';

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: getProjects });
}

export function useTodos(projectId: string) {
  return useQuery({ queryKey: ['todos', projectId], queryFn: () => getTodos(projectId) });
}

export function useSprints(projectId: string) {
  return useQuery({ queryKey: ['sprints', projectId], queryFn: () => getSprints(projectId) });
}

// Call this after saving something, so every list shows the new data.
export function refreshProjectData(queryClient: QueryClient, projectId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['todos', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['sprints', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projects'] }),
  ]);
}
