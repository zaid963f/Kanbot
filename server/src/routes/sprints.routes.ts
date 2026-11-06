import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db, type SprintRecord } from '../db/store.js';
import { badRequest, conflict } from '../lib/errors.js';
import { currentUser } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import {
  activeSprintOf,
  addDays,
  getProject,
  getSprint,
  listOf,
  moveTodo,
  now,
  renumber,
  sortSprints,
  statsFor,
  today,
  todosOfSprint,
  toSprint,
  toTodo,
} from '../services/board.service.js';
import { DONE_STATUS, type SprintBoardResponse, type SprintListResponse, type Todo, type TodoStatus } from '../types/api.js';
import { dateOnly } from './schemas.js';

/** Mounted at /api. */
export const sprintsRouter = Router();

const fields = {
  name: z.string().trim().min(1, 'Name is required').max(80),
  goal: z.string().trim().max(300),
  startDate: dateOnly.nullable(),
  endDate: dateOnly.nullable(),
};

function assertDates(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (startDate && endDate && endDate < startDate) throw badRequest('End date must be on or after the start date', 'endDate');
}

sprintsRouter.get('/projects/:projectId/sprints', (req, res) => {
  const project = getProject(currentUser(req).id, req.params.projectId);
  const sprints = sortSprints(db.data.sprints.filter((s) => s.projectId === project.id));
  res.json({ sprints: sprints.map(toSprint) } satisfies SprintListResponse);
});

sprintsRouter.post('/projects/:projectId/sprints', (req, res) => {
  const project = getProject(currentUser(req).id, req.params.projectId);
  const body = parse(
    z.object({
      name: fields.name.optional(),
      goal: fields.goal.default(''),
      startDate: fields.startDate.default(null),
      endDate: fields.endDate.default(null),
      todoIds: z.array(z.string()).max(100).default([]),
    }),
    req.body,
  );
  assertDates(body.startDate, body.endDate);
  const todos = body.todoIds.map((id, i) => {
    const todo = db.data.todos.find((t) => t.id === id && t.projectId === project.id);
    if (!todo) throw badRequest('Todo not found', `todoIds.${i}`);
    if (todo.sprintId !== null) throw badRequest(`${todo.key} is not in the backlog`, `todoIds.${i}`);
    return todo;
  });

  const sprint = db.write(() => {
    const s: SprintRecord = {
      id: randomUUID(),
      projectId: project.id,
      name: body.name ?? `Sprint ${project.nextSprintNumber}`,
      goal: body.goal,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'planned',
      startedAt: null,
      completedAt: null,
      completedStats: null,
      summary: null,
      createdAt: now(),
      updatedAt: now(),
    };
    project.nextSprintNumber++;
    db.data.sprints.push(s);
    for (const todo of todos) moveTodo(todo, { sprintId: s.id, status: todo.status, position: Number.MAX_SAFE_INTEGER });
    project.updatedAt = now();
    return s;
  });
  res.status(201).json({ sprint: toSprint(sprint) });
});

sprintsRouter.get('/sprints/:sprintId', (req, res) => {
  const { sprint } = getSprint(currentUser(req).id, req.params.sprintId);
  res.json({ sprint: toSprint(sprint) });
});

/** The board: the sprint plus its todos grouped by status column. */
sprintsRouter.get('/sprints/:sprintId/todos', (req, res) => {
  const { sprint, project } = getSprint(currentUser(req).id, req.params.sprintId);
  const columns: Record<TodoStatus, Todo[]> = Object.fromEntries(project.statuses.map((s) => [s.id, [] as Todo[]]));
  for (const todo of todosOfSprint(sprint.id)) (columns[todo.status] ??= []).push(toTodo(todo));
  res.json({ sprint: toSprint(sprint), columns } satisfies SprintBoardResponse);
});

sprintsRouter.patch('/sprints/:sprintId', (req, res) => {
  const { sprint, project } = getSprint(currentUser(req).id, req.params.sprintId);
  const body = parse(z.object(fields).partial(), req.body);
  assertDates(body.startDate === undefined ? sprint.startDate : body.startDate, body.endDate === undefined ? sprint.endDate : body.endDate);
  db.write(() => {
    Object.assign(sprint, body, { updatedAt: now() });
    project.updatedAt = now();
  });
  res.json({ sprint: toSprint(sprint) });
});

/** Only planned sprints can be deleted; their todos go back to the end of the backlog. */
sprintsRouter.delete('/sprints/:sprintId', (req, res) => {
  const { sprint } = getSprint(currentUser(req).id, req.params.sprintId);
  if (sprint.status !== 'planned') throw conflict('Only planned sprints can be deleted.');
  db.write((d) => {
    for (const todo of todosOfSprint(sprint.id)) {
      moveTodo(todo, { sprintId: null, status: todo.status, position: Number.MAX_SAFE_INTEGER });
    }
    d.sprints = d.sprints.filter((s) => s.id !== sprint.id);
  });
  res.status(204).end();
});

sprintsRouter.post('/sprints/:sprintId/start', (req, res) => {
  const { sprint, project } = getSprint(currentUser(req).id, req.params.sprintId);
  const body = parse(z.object({ startDate: dateOnly.optional(), endDate: dateOnly.optional() }), req.body ?? {});
  if (sprint.status !== 'planned') throw conflict('Only planned sprints can be started.');
  const active = activeSprintOf(project.id);
  if (active) throw conflict(`"${active.name}" is still active. Complete it before starting another sprint.`);
  const startDate = body.startDate ?? sprint.startDate ?? today();
  const endDate = body.endDate ?? (sprint.endDate && sprint.endDate >= startDate ? sprint.endDate : addDays(startDate, 14));
  assertDates(startDate, endDate);
  db.write(() => {
    Object.assign(sprint, { status: 'active', startDate, endDate, startedAt: now(), updatedAt: now() });
    project.updatedAt = now();
  });
  res.json({ sprint: toSprint(sprint) });
});

sprintsRouter.post('/sprints/:sprintId/complete', (req, res) => {
  const { sprint, project } = getSprint(currentUser(req).id, req.params.sprintId);
  const body = parse(z.object({ moveUnfinishedTo: z.string().min(1).default('backlog') }), req.body ?? {});
  if (sprint.status !== 'active') throw conflict('Only the active sprint can be completed.');

  let target: string | null = null;
  if (body.moveUnfinishedTo !== 'backlog') {
    const next = db.data.sprints.find((s) => s.id === body.moveUnfinishedTo && s.projectId === project.id);
    if (!next || next.status !== 'planned') throw badRequest('Choose the backlog or a planned sprint', 'moveUnfinishedTo');
    target = next.id;
  }

  const todos = todosOfSprint(sprint.id);
  const unfinished = todos.filter((t) => t.status !== DONE_STATUS);
  db.write(() => {
    sprint.completedStats = { ...statsFor(todos, project.statuses.map((s) => s.id)), carriedOver: unfinished.length };
    for (const todo of unfinished) moveTodo(todo, { sprintId: target, status: todo.status, position: Number.MAX_SAFE_INTEGER });
    renumber(listOf({ projectId: project.id, sprintId: sprint.id, status: DONE_STATUS }));
    Object.assign(sprint, { status: 'completed', completedAt: now(), updatedAt: now() });
    project.updatedAt = now();
  });
  res.json({ sprint: toSprint(sprint) });
});
