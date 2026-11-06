/**
 * End-to-end check of every endpoint with the mock AI.
 * Uses a throwaway database file; does not touch ./data.   npm run smoke
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_FILE = join(mkdtempSync(join(tmpdir(), 'kanbot-smoke-')), 'db.json');
process.env.NODE_ENV = 'test';
process.env.AI_API_KEY = ''; // always test the mock
const { createApp } = await import('../app.js');

const server = createApp().listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
let token = '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

let passed = 0;
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    server.close();
    throw err;
  }
}

let projectId = '';
let sprintId = '';
let nextSprintId = '';
const ids: string[] = [];

console.log('Kanbot API smoke test');

await step('health', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
});

await step('auth: guard, register, duplicate, login, me', async () => {
  assert.equal((await call('GET', '/projects')).status, 401);
  const bad = await call('POST', '/auth/register', { name: '', email: 'nope', password: '123' });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.code, 'VALIDATION_ERROR');
  assert.ok(bad.json.error.details.some((d: { path: string }) => d.path === 'email'));
  const reg = await call('POST', '/auth/register', { name: 'Sara', email: 'Sara@Test.dev', password: 'password123' });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.email, 'sara@test.dev');
  assert.equal((await call('POST', '/auth/register', { name: 'S', email: 'sara@test.dev', password: 'password123' })).status, 409);
  assert.equal((await call('POST', '/auth/login', { email: 'sara@test.dev', password: 'wrong-password' })).status, 401);
  const login = await call('POST', '/auth/login', { email: 'sara@test.dev', password: 'password123' });
  assert.equal(login.status, 200);
  token = login.json.token;
  assert.equal((await call('GET', '/auth/me')).json.user.name, 'Sara');
});

await step('projects: create (auto key), list, update, unique key', async () => {
  const r = await call('POST', '/projects', { name: 'Mobile App Redesign' });
  assert.equal(r.status, 201);
  assert.equal(r.json.project.key, 'MAR');
  projectId = r.json.project.id;
  const second = await call('POST', '/projects', { name: 'Other', key: 'oth' });
  assert.equal(second.json.project.key, 'OTH');
  assert.equal((await call('PATCH', `/projects/${second.json.project.id}`, { key: 'MAR' })).status, 409);
  assert.equal((await call('GET', '/projects')).json.projects.length, 2);
  const upd = await call('PATCH', `/projects/${projectId}`, { description: 'New look' });
  assert.equal(upd.json.project.description, 'New look');
  assert.equal((await call('DELETE', `/projects/${second.json.project.id}`)).status, 204);
});

await step('todos: create, bulk, validation, list + filters', async () => {
  const one = await call('POST', `/projects/${projectId}/todos`, { title: 'Login screen', priority: 'high', storyPoints: 3 });
  assert.equal(one.status, 201);
  assert.equal(one.json.todo.key, 'MAR-1');
  assert.equal(one.json.todo.sprintId, null);
  ids.push(one.json.todo.id);
  assert.equal((await call('POST', `/projects/${projectId}/todos`, { title: 'x', storyPoints: 4 })).status, 400);
  const bulk = await call('POST', `/projects/${projectId}/todos/bulk`, {
    todos: [
      { title: 'Profile page', storyPoints: 5, labels: ['profile'] },
      { title: 'Crash on logout', type: 'bug', priority: 'urgent', storyPoints: 1 },
      { title: 'Settings page', storyPoints: 8 },
      { title: 'Unestimated thing' },
    ],
  });
  assert.equal(bulk.status, 201);
  assert.deepEqual(bulk.json.todos.map((t: { order: number }) => t.order), [1, 2, 3, 4]);
  ids.push(...bulk.json.todos.map((t: { id: string }) => t.id));
  assert.equal((await call('GET', `/projects/${projectId}/todos?sprintId=backlog`)).json.todos.length, 5);
  assert.equal((await call('GET', `/projects/${projectId}/todos?type=bug`)).json.todos.length, 1);
  assert.equal((await call('GET', `/projects/${projectId}/todos?search=PROFILE`)).json.todos.length, 1);
});

await step('todos: reorder backlog with move', async () => {
  const r = await call('POST', `/todos/${ids[3]}/move`, { position: 0 });
  assert.equal(r.status, 200);
  const keys = (await call('GET', `/projects/${projectId}/todos?sprintId=backlog`)).json.todos.map((t: { title: string }) => t.title);
  assert.equal(keys[0], 'Settings page');
});

await step('sprints: create with todos, start, one active only', async () => {
  const s = await call('POST', `/projects/${projectId}/sprints`, { goal: 'Auth', todoIds: [ids[0], ids[1], ids[2]] });
  assert.equal(s.status, 201);
  assert.equal(s.json.sprint.name, 'Sprint 1');
  assert.equal(s.json.sprint.stats.totalPoints, 9);
  sprintId = s.json.sprint.id;
  const s2 = await call('POST', `/projects/${projectId}/sprints`, {});
  nextSprintId = s2.json.sprint.id;
  assert.equal(s2.json.sprint.name, 'Sprint 2');
  const started = await call('POST', `/sprints/${sprintId}/start`, {});
  assert.equal(started.status, 200);
  assert.equal(started.json.sprint.status, 'active');
  assert.ok(started.json.sprint.endDate > started.json.sprint.startDate);
  assert.equal((await call('POST', `/sprints/${nextSprintId}/start`, {})).status, 409);
  const project = await call('GET', `/projects/${projectId}`);
  assert.equal(project.json.project.stats.activeSprint.id, sprintId);
  assert.equal(project.json.project.stats.backlogCount, 2);
});

await step('board: columns, drag between columns, patch status', async () => {
  let board = await call('GET', `/sprints/${sprintId}/todos`);
  assert.equal(board.json.columns.todo.length, 3);
  await call('POST', `/todos/${ids[0]}/move`, { status: 'in_progress', position: 0 });
  const done = await call('PATCH', `/todos/${ids[2]}`, { status: 'done' });
  assert.ok(done.json.todo.completedAt);
  board = await call('GET', `/sprints/${sprintId}/todos`);
  assert.equal(board.json.columns.todo.length, 1);
  assert.equal(board.json.columns.in_progress.length, 1);
  assert.equal(board.json.columns.done.length, 1);
  assert.equal(board.json.sprint.stats.donePoints, 1);
  // move a backlog todo into the sprint's "todo" column
  await call('POST', `/todos/${ids[4]}/move`, { sprintId, status: 'todo', position: 0 });
  board = await call('GET', `/sprints/${sprintId}/todos`);
  assert.equal(board.json.columns.todo[0].id, ids[4]);
});

await step('ai: status, generate todos, plan sprint, chat (mock)', async () => {
  assert.equal((await call('GET', '/ai/status')).json.mode, 'mock');
  const gen = await call('POST', `/projects/${projectId}/ai/generate-todos`, { prompt: 'User profile page', count: 4 });
  assert.equal(gen.status, 200);
  assert.equal(gen.json.todos.length, 4);
  assert.equal(gen.json.source, 'mock');
  const list = await call('POST', `/projects/${projectId}/ai/generate-todos`, { prompt: '- add avatar\n- fix crash on save\n- edit bio' });
  assert.equal(list.json.todos.length, 3);
  assert.equal(list.json.todos[1].type, 'bug');
  assert.equal((await call('POST', `/projects/${projectId}/ai/generate-todos`, { prompt: '' })).status, 400);
  const plan = await call('POST', `/projects/${projectId}/ai/plan-sprint`, { capacity: 5 });
  assert.equal(plan.status, 200);
  assert.ok(plan.json.totalPoints <= 5);
  assert.ok(plan.json.reasoning.length > 0);
  const chat = await call('POST', `/projects/${projectId}/ai/chat`, { messages: [{ role: 'user', content: 'How is the sprint going?' }] });
  assert.equal(chat.json.message.role, 'assistant');
  assert.match(chat.json.message.content, /Sprint 1/);
  assert.equal((await call('POST', `/projects/${projectId}/ai/chat`, { messages: [{ role: 'assistant', content: 'hi' }] })).status, 400);
});

await step('sprints: complete → unfinished to next sprint, summary, read-only', async () => {
  assert.equal((await call('POST', `/sprints/${sprintId}/complete`, { moveUnfinishedTo: 'nope' })).status, 400);
  const r = await call('POST', `/sprints/${sprintId}/complete`, { moveUnfinishedTo: nextSprintId });
  assert.equal(r.status, 200);
  assert.equal(r.json.sprint.status, 'completed');
  assert.equal(r.json.sprint.completedStats.carriedOver, 3);
  assert.equal(r.json.sprint.completedStats.doneTodos, 1);
  assert.equal((await call('GET', `/sprints/${nextSprintId}/todos`)).json.sprint.stats.totalTodos, 3);
  assert.equal((await call('POST', `/todos/${ids[2]}/move`, { status: 'todo', position: 0 })).status, 409);
  const sum = await call('POST', `/sprints/${sprintId}/ai/summary`);
  assert.equal(sum.status, 200);
  assert.match(sum.json.summary.content, /Highlights/);
  assert.equal(sum.json.sprint.summary.content, sum.json.summary.content);
  assert.equal((await call('POST', `/sprints/${nextSprintId}/ai/summary`)).status, 409);
  const sprints = await call('GET', `/projects/${projectId}/sprints`);
  assert.deepEqual(sprints.json.sprints.map((s: { status: string }) => s.status), ['planned', 'completed']);
});

await step('delete: planned sprint returns todos to backlog, todo delete, 404s', async () => {
  assert.equal((await call('DELETE', `/sprints/${nextSprintId}`)).status, 204);
  assert.equal((await call('GET', `/projects/${projectId}/todos?sprintId=backlog`)).json.todos.length, 4);
  assert.equal((await call('DELETE', `/todos/${ids[3]}`)).status, 204);
  assert.equal((await call('GET', `/todos/${ids[3]}`)).status, 404);
  assert.equal((await call('GET', '/projects/does-not-exist')).status, 404);
  assert.equal((await call('GET', '/nope')).status, 404);
});

await step('workflow: rename built-ins, add/remove custom statuses and priorities', async () => {
  const project = (await call('GET', `/projects/${projectId}`)).json.project;
  assert.deepEqual(project.statuses.map((s: { id: string }) => s.id), ['todo', 'in_progress', 'in_review', 'done']);
  assert.deepEqual(project.priorities.map((p: { id: string }) => p.id), ['low', 'medium', 'high', 'urgent']);

  // Rename "todo", add a custom status and priority.
  const keep = (list: { id: string; name: string; color: string }[]) => list.map(({ id, name, color }) => ({ id, name, color }));
  let res = await call('PATCH', `/projects/${projectId}`, {
    statuses: [{ ...keep(project.statuses)[0], name: 'Ready' }, { name: 'Blocked', color: 'red' }, ...keep(project.statuses).slice(1)],
    priorities: [...keep(project.priorities), { name: 'Critical', color: 'violet' }],
  });
  assert.equal(res.status, 200);
  const blocked = res.json.project.statuses[1];
  const critical = res.json.project.priorities[4];
  assert.equal(blocked.name, 'Blocked');
  assert.equal(blocked.builtIn, false);
  assert.equal(res.json.project.statuses[0].name, 'Ready');

  // Todos can use them; unknown values are rejected.
  const todo = (await call('POST', `/projects/${projectId}/todos`, { title: 'Custom', status: blocked.id, priority: critical.id })).json.todo;
  assert.equal(todo.status, blocked.id);
  assert.equal((await call('POST', `/projects/${projectId}/todos`, { title: 'Bad', status: 'nope' })).status, 400);
  assert.equal((await call('PATCH', `/todos/${todo.id}`, { priority: 'nope' })).status, 400);

  // Built-ins cannot be removed.
  res = await call('PATCH', `/projects/${projectId}`, { priorities: keep(res.json.project.priorities).slice(1) });
  assert.equal(res.status, 400);

  // Removing custom ones moves their todos back to the defaults.
  res = await call('PATCH', `/projects/${projectId}`, { statuses: keep(project.statuses), priorities: keep(project.priorities) });
  assert.equal(res.status, 200);
  const after = (await call('GET', `/todos/${todo.id}`)).json.todo;
  assert.equal(after.status, 'todo');
  assert.equal(after.priority, 'medium');
});

await step("isolation: another user can't see the project", async () => {
  const other = await call('POST', '/auth/register', { name: 'Omar', email: 'omar@test.dev', password: 'password123' });
  token = other.json.token;
  assert.equal((await call('GET', `/projects/${projectId}`)).status, 404);
  assert.equal((await call('GET', `/todos/${ids[0]}`)).status, 404);
  assert.equal((await call('GET', '/projects')).json.projects.length, 0);
});

server.close();
console.log(`\nAll ${passed} checks passed.`);
