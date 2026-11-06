/**
 * Domain logic shared by the routes: ownership checks, ordering, sprint stats
 * and serializers (record → API shape).
 */
import { db, type ProjectRecord, type SprintRecord, type TodoRecord, type UserRecord } from '../db/store.js';
import { conflict, notFound } from '../lib/errors.js';
import {
  DONE_STATUS,
  type Project,
  type ProjectWithStats,
  type Sprint,
  type SprintStats,
  type Todo,
  type TodoStatus,
  type User,
} from '../types/api.js';
import { toWorkflowOptions } from './workflow.service.js';

export const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// ───────────── Ownership lookups (404 for other users' data, never 403) ─────────────

export function getProject(userId: string, projectId: string): ProjectRecord {
  const project = db.data.projects.find((p) => p.id === projectId && p.userId === userId);
  if (!project) throw notFound('Project');
  return project;
}

export function getSprint(userId: string, sprintId: string): { sprint: SprintRecord; project: ProjectRecord } {
  const sprint = db.data.sprints.find((s) => s.id === sprintId);
  const project = sprint && db.data.projects.find((p) => p.id === sprint.projectId && p.userId === userId);
  if (!sprint || !project) throw notFound('Sprint');
  return { sprint, project };
}

export function getTodo(userId: string, todoId: string): { todo: TodoRecord; project: ProjectRecord } {
  const todo = db.data.todos.find((t) => t.id === todoId);
  const project = todo && db.data.projects.find((p) => p.id === todo.projectId && p.userId === userId);
  if (!todo || !project) throw notFound('Todo');
  return { todo, project };
}

/** A sprint id coming from a request body: must belong to the project and not be completed. */
export function assertOpenSprint(projectId: string, sprintId: string | null | undefined, field = 'sprintId') {
  if (sprintId == null) return;
  const sprint = db.data.sprints.find((s) => s.id === sprintId && s.projectId === projectId);
  if (!sprint) throw Object.assign(notFound('Sprint'), { details: [{ path: field, message: 'Sprint not found' }] });
  if (sprint.status === 'completed') throw conflict('You cannot add todos to a completed sprint.');
}

/** Todos of a completed sprint keep their status and sprint (they are history). */
export function assertMovable(todo: TodoRecord) {
  const sprint = todo.sprintId ? db.data.sprints.find((s) => s.id === todo.sprintId) : undefined;
  if (sprint?.status === 'completed') throw conflict(`${todo.key} belongs to a completed sprint and cannot be moved.`);
}

// ───────────── Ordering ─────────────
// A "list" is the backlog of a project (status ignored), or one status column of one sprint.

const sameList = (a: Pick<TodoRecord, 'projectId' | 'sprintId' | 'status'>) => (b: TodoRecord) =>
  b.projectId === a.projectId && b.sprintId === a.sprintId && (a.sprintId === null || b.status === a.status);

export function listOf(where: Pick<TodoRecord, 'projectId' | 'sprintId' | 'status'>, exceptId?: string): TodoRecord[] {
  return db.data.todos.filter((t) => t.id !== exceptId && sameList(where)(t)).sort(byOrder);
}

export const byOrder = (a: TodoRecord, b: TodoRecord) => a.order - b.order || a.createdAt.localeCompare(b.createdAt);

/** Rewrites `order` as 0..n-1 following the array order. Call inside db.write. */
export function renumber(list: TodoRecord[]) {
  list.forEach((t, i) => (t.order = i));
}

export function nextOrder(where: Pick<TodoRecord, 'projectId' | 'sprintId' | 'status'>): number {
  const list = listOf(where);
  return list.length ? list[list.length - 1]!.order + 1 : 0;
}

/** Sets status and keeps completedAt in sync. */
export function applyStatus(todo: TodoRecord, status: TodoStatus) {
  if (todo.status !== DONE_STATUS && status === DONE_STATUS) todo.completedAt = now();
  if (status !== DONE_STATUS) todo.completedAt = null;
  todo.status = status;
}

/** Moves a todo to (sprintId, status) at `position`, renumbering both lists. Call inside db.write. */
export function moveTodo(todo: TodoRecord, target: { sprintId: string | null; status: TodoStatus; position: number }) {
  const from = listOf(todo, todo.id);
  renumber(from);
  todo.sprintId = target.sprintId;
  applyStatus(todo, target.status);
  const to = listOf(todo, todo.id);
  const position = Math.max(0, Math.min(target.position, to.length));
  to.splice(position, 0, todo);
  renumber(to);
  todo.updatedAt = now();
}

// ───────────── Sprint stats ─────────────

/** `statuses` = the project's status ids, so empty columns show up as 0. */
export function statsFor(todos: TodoRecord[], statuses: readonly TodoStatus[] = []): SprintStats {
  const byStatus: Record<TodoStatus, number> = Object.fromEntries(statuses.map((s) => [s, 0]));
  let totalPoints = 0;
  let donePoints = 0;
  for (const t of todos) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    totalPoints += t.storyPoints ?? 0;
    if (t.status === DONE_STATUS) donePoints += t.storyPoints ?? 0;
  }
  return { totalTodos: todos.length, doneTodos: byStatus[DONE_STATUS] ?? 0, totalPoints, donePoints, byStatus };
}

export const statusIdsOf = (projectId: string): TodoStatus[] =>
  db.data.projects.find((p) => p.id === projectId)?.statuses.map((s) => s.id) ?? [];

export const todosOfSprint = (sprintId: string) => db.data.todos.filter((t) => t.sprintId === sprintId).sort(byOrder);

export function activeSprintOf(projectId: string): SprintRecord | undefined {
  return db.data.sprints.find((s) => s.projectId === projectId && s.status === 'active');
}

const STATUS_RANK = { active: 0, planned: 1, completed: 2 } as const;
export function sortSprints(sprints: SprintRecord[]): SprintRecord[] {
  return [...sprints].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank) return rank;
    if (a.status === 'completed') return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// ───────────── Serializers ─────────────

export const toUser = (u: UserRecord): User => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

export const toProject = (p: ProjectRecord): Project => ({
  id: p.id,
  name: p.name,
  key: p.key,
  description: p.description,
  statuses: toWorkflowOptions('statuses', p.statuses),
  priorities: toWorkflowOptions('priorities', p.priorities),
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export function toProjectWithStats(p: ProjectRecord): ProjectWithStats {
  const todos = db.data.todos.filter((t) => t.projectId === p.id);
  const active = activeSprintOf(p.id);
  return {
    ...toProject(p),
    stats: {
      backlogCount: todos.filter((t) => t.sprintId === null).length,
      totalTodos: todos.length,
      activeSprint: active ? { id: active.id, name: active.name } : null,
    },
  };
}

export const toTodo = (t: TodoRecord): Todo => ({ ...t, labels: [...t.labels] });

export const toSprint = (s: SprintRecord): Sprint => ({
  id: s.id,
  projectId: s.projectId,
  name: s.name,
  goal: s.goal,
  startDate: s.startDate,
  endDate: s.endDate,
  status: s.status,
  startedAt: s.startedAt,
  completedAt: s.completedAt,
  completedStats: s.completedStats,
  summary: s.summary,
  stats: statsFor(todosOfSprint(s.id), statusIdsOf(s.projectId)),
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});
