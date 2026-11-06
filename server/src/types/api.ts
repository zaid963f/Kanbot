/**
 * Kanbot API contract.
 *
 * This file is the single source of truth for every request and response
 * shape. Copy it verbatim into the frontend (client/src/types/api.ts).
 *
 * Conventions
 * - Base URL: http://localhost:4000/api
 * - Auth: `Authorization: Bearer <token>` on every route except /health, /auth/register, /auth/login
 * - Dates: ISO 8601 strings. Date-only fields (startDate, endDate, dueDate) are "YYYY-MM-DD".
 * - Errors: every non-2xx response has the body `ApiErrorBody`.
 */

// ───────────────────────────── Errors ─────────────────────────────

export type ErrorCode =
  | 'VALIDATION_ERROR' // 400 — body/query failed validation; see `details`
  | 'UNAUTHORIZED' // 401 — missing/expired token, or wrong email/password on login
  | 'NOT_FOUND' // 404 — resource does not exist or belongs to another user
  | 'CONFLICT' // 409 — e.g. email already used, a sprint is already active
  | 'RATE_LIMITED' // 429 — too many requests (auth and AI routes)
  | 'AI_ERROR' // 502 — the AI provider failed or returned something unusable
  | 'INTERNAL_ERROR'; // 500

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string; // human readable, safe to show in the UI
    details?: { path: string; message: string }[]; // only for VALIDATION_ERROR; `path` is the field name
  };
}

// ───────────────────────────── Health ─────────────────────────────

export interface HealthResponse {
  status: 'ok';
  version: string;
  time: string;
}

// ───────────────────────────── Auth ─────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface RegisterRequest {
  name: string; // 1–80 chars
  email: string;
  password: string; // 8–200 chars
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Returned by POST /auth/register (201) and POST /auth/login (200). */
export interface AuthResponse {
  token: string; // JWT, valid for 7 days by default
  user: User;
}

/** GET /auth/me */
export interface MeResponse {
  user: User;
}

// ───────────────────────────── Projects ─────────────────────────────

export interface Project {
  id: string;
  name: string;
  /** 2–6 uppercase letters, used to build todo keys, e.g. "KAN" → "KAN-12". */
  key: string;
  description: string;
  /** The board columns of this project, in display order. Always contains the built-in TODO_STATUSES. */
  statuses: WorkflowOption[];
  /** Priorities of this project, lowest first, most important last. Always contains the built-in TODO_PRIORITIES. */
  priorities: WorkflowOption[];
  createdAt: string;
  updatedAt: string;
}

/** Project list items and GET /projects/:id include these counters. */
export interface ProjectWithStats extends Project {
  stats: {
    backlogCount: number; // todos not in any sprint
    totalTodos: number;
    activeSprint: { id: string; name: string } | null;
  };
}

export interface CreateProjectRequest {
  name: string; // 1–80 chars
  key?: string; // 2–6 letters; generated from the name when omitted
  description?: string; // ≤ 500 chars
}

/**
 * PATCH /projects/:id. `statuses` / `priorities` replace the whole list (the
 * new order is kept). Built-ins must stay in the list. Todos using a removed
 * custom option move to "todo" / "medium".
 */
export type UpdateProjectRequest = Partial<CreateProjectRequest> & {
  statuses?: WorkflowOptionInput[];
  priorities?: WorkflowOptionInput[];
};

// ───────────────────────────── Statuses & priorities ─────────────────────────────

/** Colour tokens the UI knows how to render in light and dark themes. */
export const OPTION_COLORS = ['gray', 'blue', 'green', 'amber', 'red', 'violet', 'brand'] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];

export type WorkflowKind = 'statuses' | 'priorities';

export const WORKFLOW_LIMITS = { maxOptions: 12, nameMax: 30 } as const;

export interface WorkflowOption {
  /** Built-ins use their fixed id ("todo", "high", ...). Custom ones get a generated id. */
  id: string;
  /** "" = a built-in that was not renamed: show its default (translated) name. */
  name: string;
  color: OptionColor;
  /** Built-ins can be renamed, recoloured and reordered, but not removed. */
  builtIn: boolean;
}

export interface WorkflowOptionInput {
  id?: string; // omit for a new option
  name: string; // ≤ 30 chars; required for custom options, "" = default name for built-ins
  color: OptionColor;
}

// ───────────────────────────── Todos ─────────────────────────────

/** The built-in statuses every project has. Projects can add more (see `Project.statuses`). */
export const TODO_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const;
/** A status id from `Project.statuses`. "done" is the one that marks a todo as finished. */
export type TodoStatus = string;
export const DEFAULT_STATUS = 'todo';
export const DONE_STATUS = 'done';

/** The built-in priorities every project has. Projects can add more (see `Project.priorities`). */
export const TODO_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
/** A priority id from `Project.priorities`. */
export type TodoPriority = string;
export const DEFAULT_PRIORITY = 'medium';

export const TODO_TYPES = ['task', 'story', 'bug'] as const;
export type TodoType = (typeof TODO_TYPES)[number];

/** Allowed story point values (Fibonacci). `null` = not estimated. */
export const STORY_POINTS = [1, 2, 3, 5, 8, 13] as const;
export type StoryPoints = (typeof STORY_POINTS)[number];

export interface Todo {
  id: string;
  projectId: string;
  /** null = the todo is in the backlog. */
  sprintId: string | null;
  /** Human-friendly key, e.g. "KAN-12". Never changes. */
  key: string;
  title: string;
  description: string;
  type: TodoType;
  status: TodoStatus;
  priority: TodoPriority;
  storyPoints: StoryPoints | null;
  labels: string[];
  dueDate: string | null; // YYYY-MM-DD
  /**
   * Position inside its list (0-based). A "list" is the backlog, or one status
   * column of one sprint. Lists returned by the API are already sorted by it.
   */
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null; // set when status becomes "done"
}

export interface CreateTodoRequest {
  title: string; // 1–200 chars
  description?: string; // ≤ 5000 chars
  type?: TodoType; // default "task"
  status?: TodoStatus; // default "todo"; must exist in Project.statuses
  priority?: TodoPriority; // default "medium"; must exist in Project.priorities
  storyPoints?: StoryPoints | null;
  labels?: string[]; // ≤ 10 labels, each ≤ 30 chars
  dueDate?: string | null;
  sprintId?: string | null; // default null (backlog)
}

/** POST /projects/:projectId/todos/bulk — e.g. saving AI-generated drafts. */
export interface BulkCreateTodosRequest {
  todos: CreateTodoRequest[]; // 1–50 items
}

export interface BulkCreateTodosResponse {
  todos: Todo[];
}

/** PATCH /todos/:id — every field optional. Use the move endpoint to reorder. */
export type UpdateTodoRequest = Partial<CreateTodoRequest>;

/**
 * POST /todos/:id/move — drag and drop.
 * Moves a todo to another column and/or sprint/backlog, at `position` in the
 * target list (0 = top). Omitted fields keep their current value.
 */
export interface MoveTodoRequest {
  sprintId?: string | null; // null = backlog
  status?: TodoStatus;
  position: number; // clamped to the list length
}

export interface TodoListResponse {
  todos: Todo[];
}

/** Query params for GET /projects/:projectId/todos */
export interface TodoListQuery {
  /** "backlog" = only todos without a sprint, or a sprint id. Omit for all todos. */
  sprintId?: 'backlog' | string;
  status?: TodoStatus;
  priority?: TodoPriority;
  type?: TodoType;
  search?: string; // case-insensitive match on key, title, description, labels
}

// ───────────────────────────── Sprints ─────────────────────────────

export type SprintStatus = 'planned' | 'active' | 'completed';

export interface SprintStats {
  totalTodos: number;
  doneTodos: number;
  totalPoints: number; // sum of storyPoints (null counts as 0)
  donePoints: number;
  byStatus: Record<TodoStatus, number>; // every status of the project, plus any other status in use
}

export interface SprintSummary {
  content: string; // Markdown
  source: AiSource;
  generatedAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string; // e.g. "Sprint 3"
  goal: string;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  status: SprintStatus;
  startedAt: string | null;
  completedAt: string | null;
  /** Filled when the sprint is completed (snapshot of the final numbers). */
  completedStats: (SprintStats & { carriedOver: number }) | null;
  summary: SprintSummary | null;
  /** Live numbers, computed from the todos currently in this sprint. */
  stats: SprintStats;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSprintRequest {
  name?: string; // default "Sprint <n>"
  goal?: string; // ≤ 300 chars
  startDate?: string | null;
  endDate?: string | null; // must be ≥ startDate
  /** Backlog todos to move into the new sprint (e.g. from an AI plan). */
  todoIds?: string[];
}

export type UpdateSprintRequest = Omit<CreateSprintRequest, 'todoIds'>;

/** POST /sprints/:id/start — only for "planned" sprints, and only one active sprint per project. */
export interface StartSprintRequest {
  startDate?: string; // default today
  endDate?: string; // default startDate + 14 days
}

/** POST /sprints/:id/complete — only for the "active" sprint. */
export interface CompleteSprintRequest {
  /** Where unfinished (not "done") todos go: the backlog, or a planned sprint's id. */
  moveUnfinishedTo: 'backlog' | string;
}

export interface SprintListResponse {
  sprints: Sprint[]; // active first, then planned (oldest first), then completed (newest first)
}

/** GET /sprints/:id/todos — the board. Sorted by status column, then `order`. */
export interface SprintBoardResponse {
  sprint: Sprint;
  columns: Record<TodoStatus, Todo[]>; // one entry per project status
}

// ───────────────────────────── AI assistant ─────────────────────────────

/** "mock" = built-in rule-based fake (no API key configured); "ai" = a real LLM. */
export type AiSource = 'mock' | 'ai';

/** GET /ai/status */
export interface AiStatusResponse {
  mode: AiSource;
  model: string | null;
}

/** A suggested todo that is NOT saved yet. Save with POST /projects/:id/todos/bulk. */
export interface DraftTodo {
  title: string;
  description: string;
  type: TodoType;
  priority: TodoPriority; // always one of the built-in TODO_PRIORITIES
  storyPoints: StoryPoints | null;
}

/** POST /projects/:projectId/ai/generate-todos */
export interface GenerateTodosRequest {
  prompt: string; // 3–2000 chars, e.g. "User profile page with avatar upload"
  count?: number; // 1–10, default 5
}

export interface GenerateTodosResponse {
  todos: DraftTodo[];
  source: AiSource;
}

/** POST /projects/:projectId/ai/plan-sprint — suggests which backlog todos to pull into the next sprint. */
export interface PlanSprintRequest {
  capacity: number; // story points the user can do, 1–200
  focus?: string; // optional goal / theme, ≤ 300 chars
}

export interface PlanSprintResponse {
  goal: string; // suggested sprint goal
  todoIds: string[]; // backlog todo ids, in suggested order
  totalPoints: number;
  reasoning: string; // short explanation, plain text
  source: AiSource;
}

/** POST /sprints/:sprintId/ai/summary — works for active and completed sprints. Saves to `sprint.summary`. */
export interface SprintSummaryResponse {
  sprint: Sprint;
  summary: SprintSummary;
}

/** POST /projects/:projectId/ai/chat — stateless: send the whole conversation every time. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string; // ≤ 4000 chars
}

export interface ChatRequest {
  messages: ChatMessage[]; // 1–30 messages, must end with a "user" message
}

export interface ChatResponse {
  message: ChatMessage; // role is always "assistant", content is Markdown
  source: AiSource;
}
