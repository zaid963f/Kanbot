/**
 * The Kanbot assistant. Every feature has two implementations:
 *  - real: an LLM through any OpenAI-compatible API (when AI_API_KEY is set)
 *  - mock: simple rules, free and offline (default), so the frontend can be built without a key
 * Both return exactly the same shapes.
 */
import { z } from 'zod';
import { env } from '../config/env.js';
import { db, type ProjectRecord, type SprintRecord, type TodoRecord } from '../db/store.js';
import { activeSprintOf, byOrder, statsFor, todosOfSprint } from '../services/board.service.js';
import { optionName, priorityRank } from '../services/workflow.service.js';
import {
  STORY_POINTS,
  TODO_PRIORITIES,
  TODO_TYPES,
  type AiSource,
  type ChatMessage,
  type DraftTodo,
  type StoryPoints,
} from '../types/api.js';
import { complete, extractJson } from './client.js';

export const aiSource = (): AiSource => (env.aiEnabled ? 'ai' : 'mock');

/** Sort helper: most important priority first (the project's priority list is lowest → highest). */
const byPriority = (project: ProjectRecord) => (a: TodoRecord, b: TodoRecord) =>
  priorityRank(project, b.priority) - priorityRank(project, a.priority);

/** 4 → 3 or 5 (nearest allowed value), invalid → null. */
function snapPoints(n: unknown): StoryPoints | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return STORY_POINTS.reduce((best, p) => (Math.abs(p - n) < Math.abs(best - n) ? p : best), STORY_POINTS[0]);
}

const backlogOf = (projectId: string) =>
  db.data.todos.filter((t) => t.projectId === projectId && t.sprintId === null).sort(byOrder);

const line = (project: ProjectRecord) => (t: TodoRecord) =>
  `- ${t.key} [id:${t.id}] "${t.title}" (${t.type}, ${optionName(project, 'priorities', t.priority)} priority, ` +
  `${t.storyPoints ?? '?'} pts, ${optionName(project, 'statuses', t.status)})`;

/** A compact text snapshot of the project, given to the LLM as context. */
function projectContext(project: ProjectRecord): string {
  const backlog = backlogOf(project.id);
  const active = activeSprintOf(project.id);
  const parts = [`Project: ${project.name} (key ${project.key})`, project.description && `Description: ${project.description}`];
  if (active) {
    const todos = todosOfSprint(active.id);
    const s = statsFor(todos);
    parts.push(
      `Active sprint: ${active.name}, goal "${active.goal || 'none'}", ${active.startDate} → ${active.endDate}, ` +
        `${s.doneTodos}/${s.totalTodos} todos and ${s.donePoints}/${s.totalPoints} points done.`,
      'Active sprint todos:',
      ...todos.slice(0, 60).map(line(project)),
    );
  } else {
    parts.push('There is no active sprint.');
  }
  parts.push(
    `Statuses (board columns, in order): ${project.statuses.map((o) => optionName(project, 'statuses', o.id)).join(', ')}`,
    `Priorities (lowest to highest): ${project.priorities.map((o) => optionName(project, 'priorities', o.id)).join(', ')}`,
  );
  parts.push(`Backlog (${backlog.length} todos):`, ...backlog.slice(0, 80).map(line(project)));
  return parts.filter(Boolean).join('\n');
}

// ─────────────────────────── 1. Generate todos ───────────────────────────

const draftSchema = z.object({
  todos: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(5000).catch(''),
        type: z.enum(TODO_TYPES).catch('task'),
        priority: z.enum(TODO_PRIORITIES).catch('medium'),
        storyPoints: z.unknown().transform(snapPoints),
      }),
    )
    .min(1),
});

export async function generateTodos(project: ProjectRecord, prompt: string, count: number): Promise<DraftTodo[]> {
  if (!env.aiEnabled) return mockGenerateTodos(prompt, count);

  const reply = await complete([
    {
      role: 'system',
      content:
        'You are an agile assistant that breaks a feature request into small, actionable todos for a software project. ' +
        `Reply with JSON only, no prose, in this exact shape: {"todos":[{"title":string,"description":string,"type":"task"|"story"|"bug","priority":"low"|"medium"|"high"|"urgent","storyPoints":${STORY_POINTS.join('|')}}]}. ` +
        'Titles are short and start with a verb. Descriptions are 1–3 sentences with acceptance criteria. ' +
        `Return exactly ${count} todos. Do not repeat todos that already exist in the backlog.`,
    },
    { role: 'user', content: `${projectContext(project)}\n\nFeature request:\n${prompt}` },
  ]);
  const parsed = draftSchema.safeParse(extractJson(reply));
  if (!parsed.success) return mockGenerateTodos(prompt, count); // be forgiving: never leave the user empty-handed
  return parsed.data.todos.slice(0, count);
}

function mockGenerateTodos(prompt: string, count: number): DraftTodo[] {
  // A list in the prompt ("- a\n- b" or "a, b, c") becomes one todo per item.
  const items = prompt
    .split(/\n|;|,(?=\s)/)
    .map((s) => s.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim())
    .filter((s) => s.length > 2);
  if (items.length > 1) {
    return items.slice(0, count).map((title, i) => ({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      description: `Implement "${title}". Done when it works end to end and is reviewed.`,
      type: /bug|fix|error|crash/i.test(title) ? 'bug' : 'task',
      priority: i === 0 ? 'high' : 'medium',
      storyPoints: STORY_POINTS[(i % 3) + 1]!,
    }));
  }

  const topic = prompt.trim().replace(/[.!?]+$/, '').slice(0, 80);
  const all: DraftTodo[] = [
    { title: `Design the UI for ${topic}`, description: `Sketch the screens and states (empty, loading, error) for ${topic}.`, type: 'task', priority: 'high', storyPoints: 2 },
    { title: `Build the main ${topic} components`, description: `Create the components and layout for ${topic}. Done when it matches the agreed design.`, type: 'story', priority: 'high', storyPoints: 5 },
    { title: `Connect ${topic} to the API`, description: `Fetch and save data for ${topic}. Show a loader while waiting and an error message on failure.`, type: 'task', priority: 'high', storyPoints: 3 },
    { title: `Validate ${topic} forms`, description: 'Validate every input on the client and show the server validation errors under each field.', type: 'task', priority: 'medium', storyPoints: 2 },
    { title: `Handle edge cases for ${topic}`, description: 'Empty data, very long text, slow network and expired session.', type: 'bug', priority: 'medium', storyPoints: 2 },
    { title: `Make ${topic} responsive`, description: 'Works from 360px phones to wide desktop screens.', type: 'task', priority: 'medium', storyPoints: 3 },
    { title: `Write tests for ${topic}`, description: 'Cover the main happy path and one error path.', type: 'task', priority: 'low', storyPoints: 3 },
    { title: `Improve accessibility of ${topic}`, description: 'Keyboard navigation, focus states, labels and color contrast.', type: 'task', priority: 'low', storyPoints: 2 },
    { title: `Add analytics events for ${topic}`, description: 'Track the key user actions.', type: 'task', priority: 'low', storyPoints: 1 },
    { title: `Document ${topic}`, description: 'Short README section on how it works and how to test it.', type: 'task', priority: 'low', storyPoints: 1 },
  ];
  return all.slice(0, count);
}

// ─────────────────────────── 2. Plan sprint ───────────────────────────

export interface SprintPlan {
  goal: string;
  todoIds: string[];
  totalPoints: number;
  reasoning: string;
}

const planSchema = z.object({
  goal: z.string().trim().max(300).catch(''),
  todoIds: z.array(z.string()),
  reasoning: z.string().max(2000).catch(''),
});

export async function planSprint(project: ProjectRecord, capacity: number, focus?: string): Promise<SprintPlan> {
  const backlog = backlogOf(project.id);
  if (backlog.length === 0) {
    return { goal: focus ?? '', todoIds: [], totalPoints: 0, reasoning: 'The backlog is empty. Add some todos first.' };
  }
  if (!env.aiEnabled) return mockPlanSprint(project, backlog, capacity, focus);

  const reply = await complete([
    {
      role: 'system',
      content:
        'You are an agile coach helping one developer plan their next sprint. Pick backlog todos for the sprint so that the sum of ' +
        `storyPoints does not exceed the capacity of ${capacity} points. Prefer higher priority, bugs, and todos that fit the focus. ` +
        'Use the exact todo ids from the backlog list (the value after "id:"). ' +
        'Reply with JSON only: {"goal": string (one sentence sprint goal), "todoIds": string[] (in suggested order), "reasoning": string (2–4 sentences)}.',
    },
    { role: 'user', content: `${projectContext(project)}\n\nCapacity: ${capacity} points.${focus ? `\nFocus: ${focus}` : ''}` },
  ]);
  const parsed = planSchema.safeParse(extractJson(reply));
  if (!parsed.success) return mockPlanSprint(project, backlog, capacity, focus);

  // Never trust ids or math from the model: keep valid backlog ids, enforce capacity.
  const byId = new Map(backlog.map((t) => [t.id, t]));
  const picked: TodoRecord[] = [];
  let total = 0;
  for (const id of new Set(parsed.data.todoIds)) {
    const todo = byId.get(id);
    if (!todo || total + (todo.storyPoints ?? 0) > capacity) continue;
    picked.push(todo);
    total += todo.storyPoints ?? 0;
  }
  return {
    goal: parsed.data.goal || focus || `Deliver ${picked[0]?.title ?? 'the top backlog items'}`,
    todoIds: picked.map((t) => t.id),
    totalPoints: total,
    reasoning: parsed.data.reasoning,
  };
}

function mockPlanSprint(project: ProjectRecord, backlog: TodoRecord[], capacity: number, focus?: string): SprintPlan {
  const words = (focus ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const matchesFocus = (t: TodoRecord) => words.some((w) => `${t.title} ${t.description} ${t.labels.join(' ')}`.toLowerCase().includes(w));
  const ranked = backlog
    .filter((t) => t.storyPoints !== null)
    .sort(
      (a, b) =>
        Number(matchesFocus(b)) - Number(matchesFocus(a)) ||
        byPriority(project)(a, b) ||
        Number(b.type === 'bug') - Number(a.type === 'bug') ||
        byOrder(a, b),
    );
  const picked: TodoRecord[] = [];
  let total = 0;
  for (const t of ranked) {
    if (total + t.storyPoints! > capacity) continue;
    picked.push(t);
    total += t.storyPoints!;
  }
  const unestimated = backlog.length - ranked.length;
  const counts = [...project.priorities]
    .reverse()
    .map((p) => [optionName(project, 'priorities', p.id).toLowerCase(), picked.filter((t) => t.priority === p.id).length] as const)
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${n} ${p}`)
    .join(', ');
  return {
    goal: focus?.trim() || (picked[0] ? `Ship "${picked[0].title}" and the other top-priority items` : 'Clean up the backlog'),
    todoIds: picked.map((t) => t.id),
    totalPoints: total,
    reasoning:
      (picked.length
        ? `Picked ${picked.length} todos (${counts}) by priority${words.length ? ' and focus' : ''}, bugs first, for ${total} of ${capacity} points.`
        : `No estimated todo fits in ${capacity} points.`) +
      (unestimated ? ` ${unestimated} todo(s) without story points were skipped — estimate them to include them.` : ''),
  };
}

// ─────────────────────────── 3. Summarize sprint ───────────────────────────

export async function summarizeSprint(project: ProjectRecord, sprint: SprintRecord): Promise<string> {
  const todos = todosOfSprint(sprint.id);
  const stats = sprint.completedStats ?? { ...statsFor(todos), carriedOver: 0 };
  const done = todos.filter((t) => t.status === 'done');
  const open = todos.filter((t) => t.status !== 'done');
  const pct = stats.totalPoints ? Math.round((stats.donePoints / stats.totalPoints) * 100) : 0;

  if (!env.aiEnabled) {
    const list = (items: TodoRecord[], empty: string) => (items.length ? items.map((t) => `- **${t.key}** ${t.title}`).join('\n') : empty);
    const notFinished =
      sprint.status === 'completed'
        ? stats.carriedOver
          ? `${stats.carriedOver} todo(s) were not finished and were carried over.`
          : 'Everything planned was finished. 🎉'
        : list(open, 'Nothing left. 🎉');
    const suggestions = [
      pct < 70 && '- The sprint was over-committed. Plan fewer points next time.',
      pct >= 100 && '- You finished everything: try a slightly higher capacity next sprint.',
      open.some((t) => t.status === 'in_review') && '- Several todos are stuck in review. Review them earlier in the sprint.',
      todos.some((t) => t.storyPoints === null) && '- Some todos had no story points. Estimate everything during planning.',
      '- Keep todos small (≤ 5 points) so progress is visible every day.',
    ].filter(Boolean);
    return [
      `## ${sprint.name} summary`,
      sprint.goal && `**Goal:** ${sprint.goal}`,
      `**Progress:** ${stats.doneTodos}/${stats.totalTodos} todos, ${stats.donePoints}/${stats.totalPoints} points (${pct}%).`,
      '### Highlights',
      list(done.slice(0, 10), 'No todos were finished yet.'),
      '### Not finished',
      notFinished,
      '### Suggestions',
      ...suggestions,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return complete(
    [
      {
        role: 'system',
        content:
          'You are an agile coach writing a short sprint summary for a developer. Use Markdown with exactly these sections: ' +
          '"### Highlights", "### Not finished", "### Suggestions". Start with one sentence on whether the goal was met. ' +
          'Be concrete and encouraging, under 200 words. Mention todo keys like KAN-12.',
      },
      {
        role: 'user',
        content: [
          `Project: ${project.name}`,
          `Sprint: ${sprint.name} (${sprint.status}), goal "${sprint.goal || 'none'}", ${sprint.startDate} → ${sprint.endDate}`,
          `Stats: ${stats.doneTodos}/${stats.totalTodos} todos, ${stats.donePoints}/${stats.totalPoints} points (${pct}%), carried over: ${stats.carriedOver}`,
          'Done:',
          ...done.map(line(project)),
          'Not done:',
          ...(open.length ? open.map(line(project)) : ['(none)']),
        ].join('\n'),
      },
    ],
    { maxTokens: 800 },
  );
}

// ─────────────────────────── 4. Chat ───────────────────────────

export async function chat(project: ProjectRecord, messages: ChatMessage[]): Promise<string> {
  if (!env.aiEnabled) return mockChat(project, messages.at(-1)!.content);
  return complete(
    [
      {
        role: 'system',
        content:
          'You are Kanbot, a friendly assistant inside a personal kanban/agile app. Help the user with their todos, backlog and sprints: ' +
          'answer questions about them, suggest todos, help prioritize and plan. Be concise and use Markdown. ' +
          'You cannot change data yourself: when the user wants todos created, a sprint planned or summarized, tell them to use the ' +
          '"Create todos", "Plan sprint" or "Summarize sprint" buttons. Politely refuse unrelated topics.\n\n' +
          projectContext(project),
      },
      ...messages,
    ],
    { maxTokens: 700, temperature: 0.6 },
  );
}

function mockChat(project: ProjectRecord, question: string): string {
  const q = question.toLowerCase();
  const active = activeSprintOf(project.id);
  const backlog = backlogOf(project.id);

  if (/\b(create|add|generate|new)\b.*\b(todo|task|story|stories|tasks|todos)\b/.test(q)) {
    return 'I can draft todos for you! Click **Create todos**, describe the feature, and I will suggest a list you can review before saving.';
  }
  if (/\bplan|next sprint|capacity\b/.test(q)) {
    return `You have **${backlog.length} todos** in the backlog. Click **Plan sprint**, enter your capacity in story points, and I will pick the most important todos that fit.`;
  }
  if (/sprint|progress|status|how.*(going|doing)/.test(q)) {
    if (!active) return 'There is no active sprint right now. Plan one from the backlog and press **Start sprint**.';
    const s = statsFor(todosOfSprint(active.id), project.statuses.map((o) => o.id));
    const byStatus = project.statuses
      .filter((o) => o.id !== 'done')
      .map((o) => `${optionName(project, 'statuses', o.id)}: ${s.byStatus[o.id] ?? 0}`)
      .join(', ');
    return [
      `**${active.name}** (${active.startDate} → ${active.endDate})${active.goal ? ` — goal: _${active.goal}_` : ''}`,
      '',
      `- Done: ${s.doneTodos}/${s.totalTodos} todos, ${s.donePoints}/${s.totalPoints} points`,
      `- ${byStatus}`,
    ].join('\n');
  }
  if (/backlog|priorit|important|urgent|what.*(next|first)/.test(q)) {
    const top = [...backlog].sort((a, b) => byPriority(project)(a, b) || byOrder(a, b)).slice(0, 5);
    if (!top.length) return 'Your backlog is empty. Try **Create todos** to fill it.';
    return ['Here are the most important todos in your backlog:', '', ...top.map((t) => `- **${t.key}** ${t.title} _(${optionName(project, 'priorities', t.priority)}, ${t.storyPoints ?? '?'} pts)_`)].join('\n');
  }
  return [
    "Hi! I'm Kanbot, your sprint assistant. _(Running in mock mode — answers are rule-based, not a real AI.)_",
    '',
    'Try asking me:',
    '- "How is the sprint going?"',
    '- "What should I work on next?"',
    '- "Plan my next sprint"',
    '- "Create todos for a login page"',
  ].join('\n');
}
