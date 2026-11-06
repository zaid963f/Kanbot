import { z } from 'zod';
import { DEFAULT_PRIORITY, DEFAULT_STATUS, STORY_POINTS, TODO_TYPES } from '../types/api.js';

export const dateOnly = z.iso.date('Use the format YYYY-MM-DD');
// Statuses and priorities are per project: routes check them with assertWorkflowValues.
export const status = z.string().trim().min(1, 'Status is required').max(40);
export const priority = z.string().trim().min(1, 'Priority is required').max(40);
export const todoType = z.enum(TODO_TYPES);
export const storyPoints = z
  .number()
  .refine((n): n is (typeof STORY_POINTS)[number] => (STORY_POINTS as readonly number[]).includes(n), {
    message: `Story points must be one of ${STORY_POINTS.join(', ')}`,
  });

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(5000).default(''),
  type: todoType.default('task'),
  status: status.default(DEFAULT_STATUS),
  priority: priority.default(DEFAULT_PRIORITY),
  storyPoints: storyPoints.nullable().default(null),
  labels: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  dueDate: dateOnly.nullable().default(null),
  sprintId: z.string().nullable().default(null),
});

export const updateTodoSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().max(5000),
    type: todoType,
    status,
    priority,
    storyPoints: storyPoints.nullable(),
    labels: z.array(z.string().trim().min(1).max(30)).max(10),
    dueDate: dateOnly.nullable(),
    sprintId: z.string().nullable(),
  })
  .partial();
