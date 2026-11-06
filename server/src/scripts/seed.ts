/**
 * Resets the database with a demo account and realistic data.   npm run seed
 *   demo@kanbot.dev / password123
 * One project with: a completed sprint (with summary), an active sprint
 * (todos in every column), a planned sprint, and a backlog.
 */
import { randomUUID } from 'node:crypto';
import { db, type Data, type ProjectRecord, type SprintRecord, type TodoRecord } from '../db/store.js';
import { hashPassword } from '../lib/password.js';
import { addDays, today } from '../services/board.service.js';
import { defaultPriorities, defaultStatuses } from '../services/workflow.service.js';
import type { StoryPoints, TodoPriority, TodoStatus, TodoType } from '../types/api.js';

const iso = (date: string) => `${date}T09:00:00.000Z`;
const t0 = today();

const user = {
  id: randomUUID(),
  name: 'Demo Student',
  email: 'demo@kanbot.dev',
  passwordHash: await hashPassword('password123'),
  createdAt: iso(addDays(t0, -30)),
};

const project: ProjectRecord = {
  id: randomUUID(),
  userId: user.id,
  name: 'Kanbot Web App',
  key: 'KAN',
  description: 'Building the Kanbot frontend: auth, backlog, sprint board and the AI assistant.',
  nextTodoNumber: 1,
  nextSprintNumber: 4,
  statuses: defaultStatuses(),
  priorities: defaultPriorities(),
  createdAt: iso(addDays(t0, -30)),
  updatedAt: iso(t0),
};

const sideProject: ProjectRecord = {
  id: randomUUID(),
  userId: user.id,
  name: 'Personal Portfolio',
  key: 'PORT',
  description: 'My portfolio website.',
  nextTodoNumber: 1,
  nextSprintNumber: 1,
  statuses: defaultStatuses(),
  priorities: defaultPriorities(),
  createdAt: iso(addDays(t0, -10)),
  updatedAt: iso(addDays(t0, -2)),
};

const sprint = (p: Partial<SprintRecord> & Pick<SprintRecord, 'name' | 'status'>): SprintRecord => ({
  id: randomUUID(),
  projectId: project.id,
  goal: '',
  startDate: null,
  endDate: null,
  startedAt: null,
  completedAt: null,
  completedStats: null,
  summary: null,
  createdAt: iso(addDays(t0, -30)),
  updatedAt: iso(t0),
  ...p,
});

const sprint1 = sprint({
  name: 'Sprint 1',
  status: 'completed',
  goal: 'Set up the project and authentication',
  startDate: addDays(t0, -21),
  endDate: addDays(t0, -8),
  startedAt: iso(addDays(t0, -21)),
  completedAt: iso(addDays(t0, -8)),
  completedStats: {
    totalTodos: 5,
    doneTodos: 4,
    totalPoints: 16,
    donePoints: 13,
    byStatus: { todo: 0, in_progress: 1, in_review: 0, done: 4 },
    carriedOver: 1,
  },
  summary: {
    source: 'mock',
    generatedAt: iso(addDays(t0, -8)),
    content: [
      '## Sprint 1 summary',
      '**Goal:** Set up the project and authentication',
      '**Progress:** 4/5 todos, 13/16 points (81%).',
      '### Highlights',
      '- **KAN-1** Set up Vite + React + TypeScript\n- **KAN-2** Build the login page\n- **KAN-3** Build the register page\n- **KAN-4** Add the auth guard',
      '### Not finished',
      '1 todo(s) were not finished and were carried over.',
      '### Suggestions',
      '- Keep todos small (≤ 5 points) so progress is visible every day.',
    ].join('\n\n'),
  },
});
const sprint2 = sprint({
  name: 'Sprint 2',
  status: 'active',
  goal: 'A working backlog and sprint board',
  startDate: addDays(t0, -6),
  endDate: addDays(t0, 8),
  startedAt: iso(addDays(t0, -6)),
});
const sprint3 = sprint({ name: 'Sprint 3', status: 'planned', goal: 'Ship the AI assistant' });

type Seed = [title: string, type: TodoType, priority: TodoPriority, points: StoryPoints | null, status: TodoStatus, labels?: string[]];

const todos: TodoRecord[] = [];
function add(p: ProjectRecord, sprintId: string | null, items: Seed[]) {
  const orders = new Map<string, number>();
  for (const [title, type, priority, storyPoints, status, labels = []] of items) {
    const list = sprintId === null ? 'backlog' : status;
    const order = orders.get(list) ?? 0;
    orders.set(list, order + 1);
    const created = iso(addDays(t0, -20 + todos.length % 15));
    todos.push({
      id: randomUUID(),
      projectId: p.id,
      sprintId,
      key: `${p.key}-${p.nextTodoNumber++}`,
      title,
      description: `${title}. Done when it works, handles loading and error states, and is reviewed.`,
      type,
      status,
      priority,
      storyPoints,
      labels,
      dueDate: null,
      order,
      createdAt: created,
      updatedAt: created,
      completedAt: status === 'done' ? iso(addDays(t0, -3)) : null,
    });
  }
}

add(project, sprint1.id, [
  ['Set up Vite + React + TypeScript', 'task', 'high', 2, 'done', ['setup']],
  ['Build the login page', 'story', 'high', 3, 'done', ['auth']],
  ['Build the register page', 'story', 'high', 3, 'done', ['auth']],
  ['Add the auth guard', 'task', 'urgent', 5, 'done', ['auth']],
]);
add(project, sprint2.id, [
  ['Persist the session across reloads', 'task', 'high', 3, 'done', ['auth']], // carried over from Sprint 1
  ['Projects list page', 'story', 'high', 3, 'done'],
  ['Backlog list with create todo', 'story', 'high', 5, 'in_review', ['backlog']],
  ['Todo details modal', 'story', 'medium', 5, 'in_progress'],
  ['Drag and drop between columns', 'story', 'high', 8, 'in_progress', ['board']],
  ['Sprint progress bar', 'task', 'low', 2, 'todo', ['board']],
  ['Board shows wrong count after delete', 'bug', 'urgent', 1, 'todo', ['board']],
]);
add(project, sprint3.id, [
  ['AI assistant chat panel', 'story', 'high', 5, 'todo', ['ai']],
  ['Generate todos with AI', 'story', 'high', 5, 'todo', ['ai']],
]);
add(project, null, [
  ['Plan sprint with AI', 'story', 'high', 5, 'todo', ['ai']],
  ['Sprint summary with AI', 'story', 'medium', 3, 'todo', ['ai']],
  ['Complete sprint dialog', 'story', 'high', 3, 'todo'],
  ['Sprints history page', 'story', 'medium', 3, 'todo'],
  ['Search and filter the backlog', 'task', 'medium', 3, 'todo', ['backlog']],
  ['Empty states for every page', 'task', 'low', 2, 'todo'],
  ['Login button stays disabled after an error', 'bug', 'high', 1, 'todo', ['auth']],
  ['Dark mode', 'story', 'low', 5, 'todo'],
  ['Keyboard shortcuts', 'task', 'low', null, 'todo'],
]);
add(sideProject, null, [
  ['Write the About section', 'task', 'medium', 2, 'todo'],
  ['Add project screenshots', 'task', 'low', 1, 'todo'],
]);

const data: Data = { users: [user], projects: [project, sideProject], sprints: [sprint1, sprint2, sprint3], todos };
db.reset(data);
await db.flush();
console.log(`Seeded ${todos.length} todos, 3 sprints, 2 projects.`);
console.log('Log in with demo@kanbot.dev / password123');
