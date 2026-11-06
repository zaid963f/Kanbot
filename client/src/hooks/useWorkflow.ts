import { TODO_PRIORITIES, TODO_STATUSES, type OptionColor, type WorkflowKind, type WorkflowOption } from '../types/api';
import { optionLabel } from '../utils/labels';
import { useProjects } from './useProjectData';

const DEFAULT_COLORS: Record<string, OptionColor> = {
  todo: 'gray',
  in_progress: 'blue',
  in_review: 'amber',
  done: 'green',
  low: 'gray',
  medium: 'amber',
  high: 'brand',
  urgent: 'red',
};

const builtIns = (ids: readonly string[]): WorkflowOption[] =>
  ids.map((id) => ({ id, name: '', color: DEFAULT_COLORS[id] ?? 'gray', builtIn: true }));

// Shown while the project list is still loading.
const FALLBACK = { statuses: builtIns(TODO_STATUSES), priorities: builtIns(TODO_PRIORITIES) };

export interface ResolvedOption extends WorkflowOption {
  label: string;
}

export interface Workflow {
  /** Board columns, in order. */
  statuses: ResolvedOption[];
  /** Lowest first, most important last. */
  priorities: ResolvedOption[];
  status: (id: string) => ResolvedOption;
  priority: (id: string) => ResolvedOption;
}

function resolve(kind: WorkflowKind, options: WorkflowOption[]) {
  const list = options.map((o) => ({ ...o, label: optionLabel(kind, o) }));
  // A todo can briefly have an id the cached project does not know yet (e.g. just deleted).
  const find = (id: string): ResolvedOption =>
    list.find((o) => o.id === id) ?? { id, name: id, color: 'gray', builtIn: false, label: id };
  return { list, find };
}

// The statuses and priorities of one project, with their labels in the current language.
export function useWorkflow(projectId: string): Workflow {
  const projects = useProjects();
  const project = projects.data?.find((p) => p.id === projectId) ?? FALLBACK;
  const statuses = resolve('statuses', project.statuses);
  const priorities = resolve('priorities', project.priorities);
  return { statuses: statuses.list, priorities: priorities.list, status: statuses.find, priority: priorities.find };
}
