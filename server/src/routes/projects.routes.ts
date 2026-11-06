import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db, type ProjectRecord, type TodoRecord } from '../db/store.js';
import { conflict } from '../lib/errors.js';
import { currentUser } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { applyStatus, getProject, moveTodo, now, toProjectWithStats } from '../services/board.service.js';
import {
  buildWorkflowList,
  defaultPriorities,
  defaultStatuses,
  fallbackFor,
  usesOption,
  workflowListSchema,
} from '../services/workflow.service.js';
import type { WorkflowKind } from '../types/api.js';

export const projectsRouter = Router();

const keySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,6}$/, 'Key must be 2–6 letters');

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  key: keySchema.optional(),
  description: z.string().trim().max(500).default(''),
});

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  key: keySchema,
  description: z.string().trim().max(500),
  statuses: workflowListSchema,
  priorities: workflowListSchema,
}).partial();

/** "Mobile App Redesign" → "MAR", "Kanbot" → "KAN". */
function keyFromName(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 4) : (words[0] ?? '').slice(0, 3);
  return key.length >= 2 ? key : 'PRJ';
}

function assertUniqueKey(userId: string, key: string, exceptId?: string) {
  if (db.data.projects.some((p) => p.userId === userId && p.key === key && p.id !== exceptId)) {
    throw Object.assign(conflict(`You already have a project with the key "${key}".`), {
      details: [{ path: 'key', message: 'This key is already used by another project' }],
    });
  }
}

projectsRouter.get('/', (req, res) => {
  const user = currentUser(req);
  const projects = db.data.projects
    .filter((p) => p.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toProjectWithStats);
  res.json({ projects });
});

projectsRouter.post('/', (req, res) => {
  const user = currentUser(req);
  const body = parse(createSchema, req.body);
  let key = body.key ?? keyFromName(body.name);
  if (!body.key) {
    // If the generated key is taken, try KANA, KANB, ...
    const base = key;
    for (let i = 0; db.data.projects.some((p) => p.userId === user.id && p.key === key); i++) {
      key = (base + String.fromCharCode(65 + i)).slice(0, 6);
    }
  }
  assertUniqueKey(user.id, key);
  const project: ProjectRecord = {
    id: randomUUID(),
    userId: user.id,
    name: body.name,
    key,
    description: body.description,
    nextTodoNumber: 1,
    nextSprintNumber: 1,
    statuses: defaultStatuses(),
    priorities: defaultPriorities(),
    createdAt: now(),
    updatedAt: now(),
  };
  db.write((d) => d.projects.push(project));
  res.status(201).json({ project: toProjectWithStats(project) });
});

projectsRouter.get('/:projectId', (req, res) => {
  const project = getProject(currentUser(req).id, req.params.projectId);
  res.json({ project: toProjectWithStats(project) });
});

projectsRouter.patch('/:projectId', (req, res) => {
  const user = currentUser(req);
  const project = getProject(user.id, req.params.projectId);
  const { statuses, priorities, ...fields } = parse(updateSchema, req.body);
  if (fields.key) assertUniqueKey(user.id, fields.key, project.id);
  // Validate both lists before changing anything.
  const lists = (
    [
      ['statuses', statuses],
      ['priorities', priorities],
    ] as const
  ).flatMap(([kind, input]) => (input ? [{ kind, ...buildWorkflowList(project, kind, input) }] : []));

  db.write((d) => {
    Object.assign(project, fields, { updatedAt: now() });
    // Note: existing todo keys keep their old prefix — keys never change.
    for (const { kind, options, removed } of lists) {
      project[kind] = options;
      if (removed.length) reassignTodos(d.todos.filter((t) => t.projectId === project.id && usesOption(kind, removed)(t)), kind);
    }
  });
  res.json({ project: toProjectWithStats(project) });
});

/** Todos whose status/priority was deleted fall back to the default one. Call inside db.write. */
function reassignTodos(todos: TodoRecord[], kind: WorkflowKind) {
  const fallback = fallbackFor(kind);
  for (const todo of todos) {
    if (kind === 'priorities') {
      todo.priority = fallback;
    } else if (todo.sprintId === null) {
      applyStatus(todo, fallback); // backlog: one list, status does not change the position
    } else {
      moveTodo(todo, { sprintId: todo.sprintId, status: fallback, position: Number.MAX_SAFE_INTEGER });
    }
    todo.updatedAt = now();
  }
}

projectsRouter.delete('/:projectId', (req, res) => {
  const project = getProject(currentUser(req).id, req.params.projectId);
  db.write((d) => {
    d.projects = d.projects.filter((p) => p.id !== project.id);
    d.sprints = d.sprints.filter((s) => s.projectId !== project.id);
    d.todos = d.todos.filter((t) => t.projectId !== project.id);
  });
  res.status(204).end();
});
