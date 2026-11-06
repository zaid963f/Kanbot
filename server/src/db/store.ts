import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { env } from '../config/env.js';
import { ensureWorkflow } from '../services/workflow.service.js';
import type {
  OptionColor,
  SprintStats,
  SprintStatus,
  SprintSummary,
  StoryPoints,
  TodoPriority,
  TodoStatus,
  TodoType,
} from '../types/api.js';

// ── Records (internal shapes — convert with serializers before sending) ──

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface WorkflowOptionRecord {
  id: string;
  name: string;
  color: OptionColor;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  key: string;
  description: string;
  /** Next number for todo keys (KAN-<n>). */
  nextTodoNumber: number;
  /** Next number for default sprint names (Sprint <n>). */
  nextSprintNumber: number;
  statuses: WorkflowOptionRecord[];
  priorities: WorkflowOptionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface SprintRecord {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  startedAt: string | null;
  completedAt: string | null;
  /** Snapshot taken when the sprint is completed. */
  completedStats: (SprintStats & { carriedOver: number }) | null;
  summary: SprintSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoRecord {
  id: string;
  projectId: string;
  sprintId: string | null;
  key: string;
  title: string;
  description: string;
  type: TodoType;
  status: TodoStatus;
  priority: TodoPriority;
  storyPoints: StoryPoints | null;
  labels: string[];
  dueDate: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Data {
  users: UserRecord[];
  projects: ProjectRecord[];
  sprints: SprintRecord[];
  todos: TodoRecord[];
}

const empty = (): Data => ({ users: [], projects: [], sprints: [], todos: [] });

/**
 * A tiny JSON-file database. All reads/writes happen in memory; every
 * `write()` schedules an atomic flush to disk (write temp file → rename).
 * Good enough for a single-process dev server.
 */
class JsonStore {
  private readonly file = resolve(env.DATA_FILE);
  private flushing: Promise<void> = Promise.resolve();
  private dirty = false;
  data: Data;

  constructor() {
    mkdirSync(dirname(this.file), { recursive: true });
    this.data = existsSync(this.file) ? { ...empty(), ...JSON.parse(readFileSync(this.file, 'utf8')) } : empty();
    this.data.projects.forEach(ensureWorkflow); // data saved before custom statuses/priorities existed
  }

  /** Mutate data, then persist. Returns whatever the mutator returns. */
  write<T>(mutate: (data: Data) => T): T {
    const result = mutate(this.data);
    this.scheduleFlush();
    return result;
  }

  /** Replace everything (used by the seed script). */
  reset(data: Data = empty()) {
    data.projects.forEach(ensureWorkflow);
    this.data = data;
    this.scheduleFlush();
  }

  /** Resolves once everything written so far is on disk. */
  async flush(): Promise<void> {
    await this.flushing;
  }

  private scheduleFlush() {
    if (this.dirty) return;
    this.dirty = true;
    this.flushing = this.flushing.then(async () => {
      this.dirty = false;
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(this.data, null, 2));
      await rename(tmp, this.file);
    });
  }
}

export const db = new JsonStore();
