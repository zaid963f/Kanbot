/**
 * Per-project statuses and priorities.
 *
 * Every project starts with the built-in ("main") options: the four board
 * columns and the four priorities. Built-ins can be renamed, recoloured and
 * reordered but never removed. Users can add their own options next to them.
 *
 * Order matters:
 *  - statuses: the order of the board columns.
 *  - priorities: lowest first, most important last (used to rank todos).
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ProjectRecord, TodoRecord, WorkflowOptionRecord } from '../db/store.js';
import { badRequest } from '../lib/errors.js';
import {
  DEFAULT_PRIORITY,
  DEFAULT_STATUS,
  OPTION_COLORS,
  TODO_PRIORITIES,
  TODO_STATUSES,
  WORKFLOW_LIMITS,
  type WorkflowKind,
  type WorkflowOption,
} from '../types/api.js';

/** English names of the built-ins, used when the user has not renamed them (AI prompts, errors). */
export const BUILT_IN_NAMES: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const BUILT_INS: Record<WorkflowKind, readonly string[]> = { statuses: TODO_STATUSES, priorities: TODO_PRIORITIES };

export const defaultStatuses = (): WorkflowOptionRecord[] => [
  { id: 'todo', name: '', color: 'gray' },
  { id: 'in_progress', name: '', color: 'blue' },
  { id: 'in_review', name: '', color: 'amber' },
  { id: 'done', name: '', color: 'green' },
];

export const defaultPriorities = (): WorkflowOptionRecord[] => [
  { id: 'low', name: '', color: 'gray' },
  { id: 'medium', name: '', color: 'amber' },
  { id: 'high', name: '', color: 'brand' },
  { id: 'urgent', name: '', color: 'red' },
];

/** Projects saved before custom options existed get the defaults. */
export function ensureWorkflow(project: ProjectRecord) {
  project.statuses ??= defaultStatuses();
  project.priorities ??= defaultPriorities();
}

export const isBuiltIn = (kind: WorkflowKind, id: string) => BUILT_INS[kind].includes(id);

export const toWorkflowOptions = (kind: WorkflowKind, options: WorkflowOptionRecord[]): WorkflowOption[] =>
  options.map((o) => ({ ...o, builtIn: isBuiltIn(kind, o.id) }));

/** Display name of an option ("" for an unrenamed built-in → its English default). */
export function optionName(project: ProjectRecord, kind: WorkflowKind, id: string): string {
  const option = project[kind].find((o) => o.id === id);
  return option?.name || BUILT_IN_NAMES[id] || id;
}

/** Higher = more important. Unknown ids rank lowest. */
export const priorityRank = (project: ProjectRecord, id: string) => project.priorities.findIndex((p) => p.id === id);

/** Status / priority from a request body must exist in the project. */
export function assertWorkflowValues(project: ProjectRecord, values: { status?: string; priority?: string }, prefix = '') {
  if (values.status !== undefined && !project.statuses.some((s) => s.id === values.status)) {
    throw badRequest('This status does not exist in the project', `${prefix}status`);
  }
  if (values.priority !== undefined && !project.priorities.some((p) => p.id === values.priority)) {
    throw badRequest('This priority does not exist in the project', `${prefix}priority`);
  }
}

// ───────────── Editing ─────────────

export const workflowOptionInput = z.object({
  /** Omit for a new option. */
  id: z.string().trim().min(1).max(40).optional(),
  /** "" keeps the default name of a built-in. Custom options need a name. */
  name: z.string().trim().max(WORKFLOW_LIMITS.nameMax),
  color: z.enum(OPTION_COLORS),
});
export type WorkflowOptionInput = z.infer<typeof workflowOptionInput>;

export const workflowListSchema = z.array(workflowOptionInput).max(WORKFLOW_LIMITS.maxOptions);

/**
 * Validates a full replacement list and returns the records to store, plus
 * the ids that were removed (their todos must be reassigned).
 */
export function buildWorkflowList(
  project: ProjectRecord,
  kind: WorkflowKind,
  input: WorkflowOptionInput[],
): { options: WorkflowOptionRecord[]; removed: string[] } {
  const current = project[kind];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const prefix = kind === 'statuses' ? 's' : 'p';

  const options = input.map((item, i): WorkflowOptionRecord => {
    const path = `${kind}.${i}`;
    if (item.id !== undefined && !current.some((o) => o.id === item.id)) {
      throw badRequest('Unknown option id', `${path}.id`);
    }
    if (item.id !== undefined && seenIds.has(item.id)) throw badRequest('Duplicate option', `${path}.id`);
    const builtIn = item.id !== undefined && isBuiltIn(kind, item.id);
    if (!builtIn && !item.name) throw badRequest('Name is required', `${path}.name`);

    const shownName = (item.name || BUILT_IN_NAMES[item.id!]!).toLowerCase();
    if (seenNames.has(shownName)) throw badRequest('Two options have the same name', `${path}.name`);
    seenNames.add(shownName);

    const id = item.id ?? `${prefix}_${randomUUID().slice(0, 8)}`;
    seenIds.add(id);
    return { id, name: item.name, color: item.color };
  });

  const missingBuiltIn = BUILT_INS[kind].find((id) => !seenIds.has(id));
  if (missingBuiltIn) throw badRequest(`"${BUILT_IN_NAMES[missingBuiltIn]}" is built in and cannot be removed`, kind);

  const removed = current.filter((o) => !seenIds.has(o.id)).map((o) => o.id);
  return { options, removed };
}

/** What todos with a removed option fall back to. */
export const fallbackFor = (kind: WorkflowKind) => (kind === 'statuses' ? DEFAULT_STATUS : DEFAULT_PRIORITY);

export const usesOption = (kind: WorkflowKind, ids: string[]) => (t: TodoRecord) =>
  ids.includes(kind === 'statuses' ? t.status : t.priority);
